Option Explicit
Dim fso, shell, scriptDir, appDir, nodeExe, daemonJs, exitCode, execObj, portVal, targetUrl, browserExe

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
appDir = fso.GetParentFolderName(scriptDir)
shell.CurrentDirectory = appDir

Function FindNodeExecutable(baseDir)
  Dim bundled
  bundled = baseDir & "\runtime\node.exe"
  If fso.FileExists(bundled) Then
    FindNodeExecutable = bundled
    Exit Function
  End If

  On Error Resume Next
  Dim testExec, outLine
  Set testExec = shell.Exec("cmd /c where node")
  Do While testExec.Status = 0
    WScript.Sleep 50
  Loop
  If testExec.ExitCode = 0 And Not testExec.StdOut.AtEndOfStream Then
    outLine = Trim(testExec.StdOut.ReadLine())
    If outLine <> "" And fso.FileExists(outLine) Then
      FindNodeExecutable = outLine
      Exit Function
    End If
  End If
  On Error GoTo 0
  FindNodeExecutable = ""
End Function

Function FindAppBrowser()
  Dim candidates(5), i
  candidates(0) = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
  candidates(1) = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
  candidates(2) = "C:\Program Files\Google\Chrome\Application\chrome.exe"
  candidates(3) = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
  candidates(4) = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Google\Chrome\Application\chrome.exe"
  candidates(5) = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Microsoft\Edge\Application\msedge.exe"
  For i = 0 To 5
    If fso.FileExists(candidates(i)) Then
      FindAppBrowser = candidates(i)
      Exit Function
    End If
  Next
  FindAppBrowser = ""
End Function

nodeExe = FindNodeExecutable(appDir)
If nodeExe = "" Then
  MsgBox "Node.js tidak ditemukan di komputer ini.", vbCritical, "Sistem Absensi Sekolah"
  WScript.Quit 1
End If

daemonJs = appDir & "\localhost-daemon.mjs"
exitCode = shell.Run(Chr(34) & nodeExe & Chr(34) & " " & Chr(34) & daemonJs & Chr(34) & " start", 0, True)

If exitCode <> 0 Then
  MsgBox "Server Localhost gagal dijalankan. Periksa data\localhost-server.log.", vbCritical, "Sistem Absensi Sekolah"
  WScript.Quit 1
End If

portVal = "4500"
On Error Resume Next
Set execObj = shell.Exec(Chr(34) & nodeExe & Chr(34) & " " & Chr(34) & daemonJs & Chr(34) & " port")
Do While execObj.Status = 0
  WScript.Sleep 40
Loop
Do While Not execObj.StdOut.AtEndOfStream
  Dim rawPort
  rawPort = Trim(execObj.StdOut.ReadLine())
  If rawPort <> "" And IsNumeric(rawPort) Then
    portVal = rawPort
  End If
Loop
On Error GoTo 0

targetUrl = "http://localhost:" & portVal
browserExe = FindAppBrowser()

If browserExe <> "" Then
  shell.Run Chr(34) & browserExe & Chr(34) & " --app=" & Chr(34) & targetUrl & Chr(34), 1, False
Else
  shell.Run Chr(34) & targetUrl & Chr(34), 1, False
End If
