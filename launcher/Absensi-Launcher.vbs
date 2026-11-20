Option Explicit
Dim fso, shell, scriptDir, appDir, nodeExe, daemonJs, exitCode, execObj, portVal, targetUrl

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

nodeExe = FindNodeExecutable(appDir)
If nodeExe = "" Then
  MsgBox "Node.js tidak ditemukan di komputer ini." & vbCrLf & vbCrLf & _
         "Silakan install Node.js LTS dari https://nodejs.org atau gunakan paket installer lengkap.", _
         vbCritical, "Sistem Absensi Sekolah"
  WScript.Quit 1
End If

daemonJs = appDir & "\localhost-daemon.mjs"
If Not fso.FileExists(daemonJs) Then
  MsgBox "File localhost-daemon.mjs tidak ditemukan di:" & vbCrLf & appDir, vbCritical, "Sistem Absensi Sekolah"
  WScript.Quit 1
End If

' Jalankan server localhost di background tanpa menampilkan jendela CMD (0 = hidden, True = wait)
exitCode = shell.Run(Chr(34) & nodeExe & Chr(34) & " " & Chr(34) & daemonJs & Chr(34) & " start", 0, True)

If exitCode <> 0 Then
  MsgBox "Server Localhost gagal dijalankan." & vbCrLf & vbCrLf & _
         "Silakan periksa log error di:" & vbCrLf & appDir & "\data\localhost-server.log" & vbCrLf & _
         "atau jalankan start-localhost-console.bat untuk melihat detail.", _
         vbCritical, "Sistem Absensi Sekolah - Error"
  WScript.Quit 1
End If

' Ambil port aktif
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
shell.Run Chr(34) & targetUrl & Chr(34), 1, False
