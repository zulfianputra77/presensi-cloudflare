Option Explicit
Dim fso, shell, scriptDir, appDir, nodeExe, daemonJs, exitCode

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
appDir = fso.GetParentFolderName(scriptDir)
shell.CurrentDirectory = appDir

nodeExe = appDir & "\runtime\node.exe"
If Not fso.FileExists(nodeExe) Then
  nodeExe = "node"
End If

daemonJs = appDir & "\localhost-daemon.mjs"
If fso.FileExists(daemonJs) Then
  exitCode = shell.Run(Chr(34) & nodeExe & Chr(34) & " " & Chr(34) & daemonJs & Chr(34) & " stop", 0, True)
  If exitCode = 0 Then
    MsgBox "Server background Sistem Absensi Sekolah telah dihentikan.", vbInformation, "Sistem Absensi Sekolah"
  Else
    MsgBox "Gagal menghentikan server. Coba jalankan stop-localhost.bat.", vbExclamation, "Sistem Absensi Sekolah"
  End If
End If
