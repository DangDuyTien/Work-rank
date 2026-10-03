' WorkRank Silent Runner for Windows (Runs in background without console window)
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = ScriptDir
WshShell.Run "cmd.exe /c node index.js", 0, False
Set WshShell = Nothing
Set FSO = Nothing
