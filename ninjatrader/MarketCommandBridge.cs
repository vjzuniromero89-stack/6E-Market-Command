// Source indicator for NinjaTrader 8. Install through the NinjaScript Editor.
// Sends market data only. No account access and no order methods.
using System;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using NinjaTrader.NinjaScript;

namespace NinjaTrader.NinjaScript.Indicators
{
    public class MarketCommandBridge : Indicator
    {
        private int sending;
        private volatile bool stopped;
        private bool warned;
        private DateTime lastAttempt = DateTime.MinValue;
        private DateTime lastError = DateTime.MinValue;
        private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Name = "MarketCommandBridge";
                Description = "Sends 6E volumetric snapshots to your private Market Command dashboard.";
                Calculate = Calculate.OnEachTick;
                IsOverlay = true;
                IsSuspendedWhileInactive = false;
                Endpoint = "https://YOUR-SITE.vercel.app/api/ninjatrader";
                IngestToken = "";
                IntervalSeconds = 5;
            }
            else if (State == State.DataLoaded)
            {
                stopped = false;
                warned = false;
            }
            else if (State == State.Terminated)
                stopped = true;
        }

        protected override void OnBarUpdate()
        {
            if (State != State.Realtime || BarsInProgress != 0 || CurrentBar < 0 || stopped) return;
            var volumetric = Bars.BarsSeries.BarsType as NinjaTrader.NinjaScript.BarsTypes.VolumetricBarsType;
            Uri destination;
            if (Instrument.MasterInstrument.Name != "6E" || volumetric == null ||
                !Uri.TryCreate(Endpoint, UriKind.Absolute, out destination) ||
                destination.Scheme != "https" || !string.IsNullOrEmpty(destination.UserInfo) ||
                string.IsNullOrWhiteSpace(IngestToken) || IngestToken.Length < 32)
            {
                if (!warned) Print("MarketCommandBridge: use a 6E Volumetric chart, an HTTPS endpoint and an ingest key of at least 32 characters.");
                warned = true;
                return;
            }
            DateTime now = DateTime.UtcNow;
            if ((now - lastAttempt).TotalSeconds < IntervalSeconds || Interlocked.CompareExchange(ref sending, 1, 0) != 0) return;
            lastAttempt = now;
            try
            {
                // Capture all NinjaScript data on its own update thread, before starting I/O.
                var bar = volumetric.Volumes[CurrentBar];
                string payload = "{\"schemaVersion\":1,\"instrument\":" + Quote(Instrument.FullName)
                    + ",\"sentAt\":" + Quote(now.ToString("o", Inv))
                    + ",\"barTime\":" + Quote(Time[0].ToString("yyyy-MM-dd HH:mm:ss", Inv))
                    + ",\"price\":" + Close[0].ToString("R", Inv)
                    + ",\"barVolume\":" + bar.TotalVolume.ToString(Inv)
                    + ",\"barDelta\":" + bar.BarDelta.ToString(Inv)
                    + ",\"cumulativeDelta\":" + bar.CumulativeDelta.ToString(Inv) + "}";
                string target = Endpoint;
                string secret = IngestToken;
                Task.Run(() => Send(target, secret, payload));
            }
            catch
            {
                Interlocked.Exchange(ref sending, 0);
                ReportError("Cannot read volumetric bar. Check chart configuration.");
            }
        }

        private void Send(string target, string secret, string payload)
        {
            try
            {
                if (stopped) return;
                var request = (HttpWebRequest)WebRequest.Create(target);
                request.Method = "POST";
                request.ContentType = "application/json";
                request.Headers[HttpRequestHeader.Authorization] = "Bearer " + secret;
                request.AllowAutoRedirect = false;
                request.Timeout = 8000;
                request.ReadWriteTimeout = 8000;
                byte[] bytes = Encoding.UTF8.GetBytes(payload);
                request.ContentLength = bytes.Length;
                using (Stream stream = request.GetRequestStream()) stream.Write(bytes, 0, bytes.Length);
                using (var response = (HttpWebResponse)request.GetResponse())
                {
                    if ((int)response.StatusCode != 200) ReportError("HTTP " + (int)response.StatusCode + ". Check endpoint and Vercel settings.");
                }
            }
            catch (WebException error)
            {
                var response = error.Response as HttpWebResponse;
                ReportError(response == null ? "Network failure or timeout." : "HTTP " + (int)response.StatusCode + ". Check keys, storage and endpoint.");
                if (response != null) response.Dispose();
            }
            catch { ReportError("Send failed. Check connector configuration."); }
            finally { Interlocked.Exchange(ref sending, 0); }
        }

        private void ReportError(string message)
        {
            if (stopped || (DateTime.UtcNow - lastError).TotalSeconds < 60) return;
            lastError = DateTime.UtcNow;
            Print("MarketCommandBridge: " + message);
        }

        private static string Quote(string value)
        {
            return "\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "\\r").Replace("\n", "\\n") + "\"";
        }

        [NinjaScriptProperty]
        [Display(Name = "Dashboard endpoint (HTTPS)", Order = 1, GroupName = "Connection")]
        public string Endpoint { get; set; }

        [NinjaScriptProperty]
        [PasswordPropertyText(true)]
        [Display(Name = "Ingest key", Order = 2, GroupName = "Connection")]
        public string IngestToken { get; set; }

        [NinjaScriptProperty]
        [Range(5, 60)]
        [Display(Name = "Send interval (seconds)", Order = 3, GroupName = "Connection")]
        public int IntervalSeconds { get; set; }
    }
}
