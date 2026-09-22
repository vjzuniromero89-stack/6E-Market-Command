// Independent price-only NinjaTrader 8 indicator for GC and CL futures charts.
// No account access, order methods, or volumetric data collection.
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
    public class MarketCommandIntermarket : Indicator
    {
        private int sending;
        private volatile bool stopped;
        private bool warned;
        private DateTime lastAttempt = DateTime.MinValue;
        private DateTime lastError = DateTime.MinValue;
        private bool reportedConnection;
        private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        public override string DisplayName { get { return Name; } }

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Name = "MarketCommandIntermarket";
                Description = "Sends price-only GC or CL futures snapshots to Market Command.";
                Calculate = Calculate.OnEachTick;
                IsOverlay = true;
                IsSuspendedWhileInactive = false;
                Endpoint = "https://YOUR-WORKER.workers.dev/api/intermarket";
                IngestToken = "";
                IntervalSeconds = 5;
            }
            else if (State == State.DataLoaded)
            {
                stopped = false;
                warned = false;
                reportedConnection = false;
                Print("MarketCommandIntermarket: chart loaded; waiting for real-time GC/CL data.");
            }
            else if (State == State.Realtime)
            {
                string root = Instrument.MasterInstrument.Name;
                Uri destination;
                if ((root != "GC" && root != "CL") ||
                    !Uri.TryCreate(Endpoint, UriKind.Absolute, out destination) ||
                    destination.Scheme != "https" || !string.IsNullOrEmpty(destination.UserInfo) ||
                    string.IsNullOrWhiteSpace(IngestToken) || IngestToken.Length < 32)
                    Print("MarketCommandIntermarket " + root + ": cannot test connection; check chart, HTTPS endpoint and ingest key length.");
                else
                {
                    string target = Endpoint;
                    string secret = IngestToken;
                    Task.Run(() => Probe(root, target, secret));
                }
            }
            else if (State == State.Terminated)
                stopped = true;
        }

        // Empty JSON is rejected with HTTP 400 only AFTER the server accepts the
        // ingest key. This tests authorization without writing a quote to storage.
        private void Probe(string root, string target, string secret)
        {
            try
            {
                var request = (HttpWebRequest)WebRequest.Create(target);
                request.Method = "POST";
                request.ContentType = "application/json";
                request.Headers[HttpRequestHeader.Authorization] = "Bearer " + secret;
                request.AllowAutoRedirect = false;
                request.Timeout = 8000;
                request.ReadWriteTimeout = 8000;
                byte[] bytes = Encoding.UTF8.GetBytes("{}");
                request.ContentLength = bytes.Length;
                using (Stream stream = request.GetRequestStream()) stream.Write(bytes, 0, bytes.Length);
                using (var response = (HttpWebResponse)request.GetResponse())
                    Print("MarketCommandIntermarket " + root + ": diagnostic HTTP " + (int)response.StatusCode + " at " + new Uri(target).AbsolutePath + ".");
            }
            catch (WebException error)
            {
                var response = error.Response as HttpWebResponse;
                if (response == null)
                    Print("MarketCommandIntermarket " + root + ": diagnostic network failure or timeout.");
                else
                {
                    int status = (int)response.StatusCode;
                    string path = new Uri(target).AbsolutePath;
                    Print("MarketCommandIntermarket " + root + (status == 400
                        ? ": ingest key accepted at " + path + "; waiting for a new market tick."
                        : ": diagnostic HTTP " + status + " at " + path + "."));
                    response.Dispose();
                }
            }
            catch { Print("MarketCommandIntermarket " + root + ": diagnostic failed before sending."); }
        }

        protected override void OnBarUpdate()
        {
            if (State != State.Realtime || BarsInProgress != 0 || CurrentBar < 0 || stopped) return;
            string root = Instrument.MasterInstrument.Name;
            Uri destination;
            if ((root != "GC" && root != "CL") ||
                !Uri.TryCreate(Endpoint, UriKind.Absolute, out destination) ||
                destination.Scheme != "https" || !string.IsNullOrEmpty(destination.UserInfo) ||
                string.IsNullOrWhiteSpace(IngestToken) || IngestToken.Length < 32)
            {
                if (!warned) Print("MarketCommandIntermarket: use a GC or CL futures chart, HTTPS endpoint and ingest key of at least 32 characters.");
                warned = true;
                return;
            }
            DateTime now = DateTime.UtcNow;
            if ((now - lastAttempt).TotalSeconds < IntervalSeconds || Interlocked.CompareExchange(ref sending, 1, 0) != 0) return;
            lastAttempt = now;
            try
            {
                string payload = "{\"schemaVersion\":1,\"root\":" + Quote(root)
                    + ",\"instrument\":" + Quote(Instrument.FullName)
                    + ",\"sentAt\":" + Quote(now.ToString("o", Inv))
                    + ",\"barTimeUtc\":" + Quote(Time[0].ToUniversalTime().ToString("o", Inv))
                    + ",\"price\":" + Close[0].ToString("R", Inv)
                    + ",\"open\":" + Open[0].ToString("R", Inv)
                    + ",\"high\":" + High[0].ToString("R", Inv)
                    + ",\"low\":" + Low[0].ToString("R", Inv)
                    + ",\"close\":" + Close[0].ToString("R", Inv) + "}";
                string target = Endpoint;
                string secret = IngestToken;
                Task.Run(() => Send(target, secret, payload, root));
            }
            catch
            {
                Interlocked.Exchange(ref sending, 0);
                ReportError("Cannot read GC/CL chart. Check chart configuration.");
            }
        }

        private void Send(string target, string secret, string payload, string root)
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
                    if ((int)response.StatusCode != 200) ReportError(root + ": HTTP " + (int)response.StatusCode + " at " + new Uri(target).AbsolutePath + ".");
                    else if (!reportedConnection)
                    {
                        reportedConnection = true;
                        Print("MarketCommandIntermarket " + root + ": connected (HTTP 200).");
                    }
                }
            }
            catch (WebException error)
            {
                var response = error.Response as HttpWebResponse;
                ReportError(response == null ? root + ": network failure or timeout." : root + ": HTTP " + (int)response.StatusCode + " at " + new Uri(target).AbsolutePath + ".");
                if (response != null) response.Dispose();
            }
            catch { ReportError("Send failed. Check connector configuration."); }
            finally { Interlocked.Exchange(ref sending, 0); }
        }

        private void ReportError(string message)
        {
            if (stopped || (DateTime.UtcNow - lastError).TotalSeconds < 60) return;
            lastError = DateTime.UtcNow;
            Print("MarketCommandIntermarket: " + message);
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
