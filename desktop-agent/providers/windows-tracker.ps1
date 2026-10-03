# WorkRank Windows Computer Activity Telemetry Helper
# Lightweight Win32 API loop: reads idle seconds, active process name, click and keystroke counts.
# Runs inside dedicated STA worker thread attached to interactive desktop ("default").

$win32TypeDef = @"
using System;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Threading;
using System.Text;

public class WorkRankWin32 {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);

    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    [StructLayout(LayoutKind.Sequential)]
    public struct LASTINPUTINFO {
        public uint cbSize;
        public uint dwTime;
    }

    private static bool[] prevKeyStates = new bool[256];
    private static bool[] prevMouseStates = new bool[6];

    public static uint GetIdleSeconds() {
        LASTINPUTINFO lii = new LASTINPUTINFO();
        lii.cbSize = (uint)Marshal.SizeOf(lii);
        if (GetLastInputInfo(ref lii)) {
            uint tickCount = (uint)Environment.TickCount;
            return (tickCount - lii.dwTime) / 1000;
        }
        return 0;
    }

    public static string GetActiveProcessName() {
        IntPtr hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return "Desktop";
        uint pid = 0;
        GetWindowThreadProcessId(hwnd, out pid);
        if (pid == 0) return "Desktop";

        try {
            string procName = Process.GetProcessById((int)pid).ProcessName;

            // Handle Windows 10/11 UWP apps running under ApplicationFrameHost (e.g. Settings, Calculator)
            if (string.Equals(procName, "ApplicationFrameHost", StringComparison.OrdinalIgnoreCase)) {
                IntPtr childHwnd = FindWindowEx(hwnd, IntPtr.Zero, "Windows.UI.Core.CoreWindow", null);
                if (childHwnd != IntPtr.Zero) {
                    uint childPid = 0;
                    GetWindowThreadProcessId(childHwnd, out childPid);
                    if (childPid > 0 && childPid != pid) {
                        return Process.GetProcessById((int)childPid).ProcessName;
                    }
                }
            }
            return procName;
        } catch {
            return "Unknown";
        }
    }

    public static void AttachToUserDesktop() {
        try {
            IntPtr hDesk = OpenDesktop("default", 0, false, 0x01FF);
            if (hDesk == IntPtr.Zero) {
                hDesk = OpenInputDesktop(0, false, 0x01FF);
            }
            if (hDesk != IntPtr.Zero) {
                SetThreadDesktop(hDesk);
            }
        } catch {}
    }

    public static void RunLoop() {
        AttachToUserDesktop();

        int clicks = 0;
        int keys = 0;

        while (true) {
            // 40 ticks * 25ms = 1000ms window (smooth, high-accuracy, zero CPU spike)
            for (int tick = 0; tick < 40; tick++) {
                // Mouse buttons: 1=Left, 2=Right, 4=Middle
                int[] mouseKeys = new int[] { 0x01, 0x02, 0x04 };
                for (int i = 0; i < mouseKeys.Length; i++) {
                    int vk = mouseKeys[i];
                    bool isDown = (GetAsyncKeyState(vk) & 0x8000) != 0;
                    if (isDown && !prevMouseStates[i]) {
                        clicks++;
                    }
                    prevMouseStates[i] = isDown;
                }

                // Keyboard keys: 0x08 (Backspace) .. 0xFE
                for (int vk = 0x08; vk <= 0xFE; vk++) {
                    if (vk == 0x01 || vk == 0x02 || vk == 0x04) continue;
                    bool isDown = (GetAsyncKeyState(vk) & 0x8000) != 0;
                    if (isDown && !prevKeyStates[vk]) {
                        keys++;
                    }
                    prevKeyStates[vk] = isDown;
                }

                Thread.Sleep(25);
            }

            uint idle = GetIdleSeconds();
            string proc = GetActiveProcessName();

            Console.WriteLine(idle + "|" + proc + "|" + clicks + "|" + keys);
            Console.Out.Flush();

            clicks = 0;
            keys = 0;
        }
    }

    public static void StartTracker() {
        Thread worker = new Thread(RunLoop);
        worker.SetApartmentState(ApartmentState.STA);
        worker.IsBackground = false;
        worker.Start();
        worker.Join();
    }
}
"@

try {
    Add-Type -TypeDefinition $win32TypeDef -ErrorAction Stop
} catch {
    # If already compiled in current session, ignore
}

[WorkRankWin32]::StartTracker()
