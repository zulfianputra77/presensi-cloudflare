Option Explicit
Dim fso, shell, scriptDir, appDir, nodeExe, daemonJs

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
  shell.Run Chr(34) & nodeExe & Chr(34) & " " & Chr(34) & daemonJs & Chr(34) & " start", 0, False
End If
