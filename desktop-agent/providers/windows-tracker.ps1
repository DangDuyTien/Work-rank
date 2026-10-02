# WorkRank Windows Computer Activity Telemetry Helper
# Lightweight Win32 API loop: reads idle seconds and active process name with near-zero CPU usage.

$win32TypeDef = @"
using System;
using System.Runtime.InteropServices;
using System.Diagnostics;

public class WorkRankWin32 {
    [DllImport("user32.dll")]
    public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [StructLayout(LayoutKind.Sequential)]
    public struct LASTINPUTINFO {
        public uint cbSize;
        public uint dwTime;
    }

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
        uint pid;
        GetWindowThreadProcessId(hwnd, out pid);
        try {
            return Process.GetProcessById((int)pid).ProcessName;
        } catch {
            return "Unknown";
        }
    }
}
"@

try {
    Add-Type -TypeDefinition $win32TypeDef -ErrorAction Stop
} catch {
    # If already compiled in current session, ignore
}

while ($true) {
    try {
        $idle = [WorkRankWin32]::GetIdleSeconds()
        $proc = [WorkRankWin32]::GetActiveProcessName()
        Write-Output "$idle|$proc"
        [Console]::Out.Flush()
    } catch {
        Write-Output "0|Unknown"
        [Console]::Out.Flush()
    }
    Start-Sleep -Seconds 1
}
