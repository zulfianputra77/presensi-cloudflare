; Script Installer Windows (Inno Setup 6)
; Menghasilkan Setup-Absensi-Sekolah-v1.0.0.exe (seperti installer Dapodik & e-Rapor)

#define MyAppName "Sistem Absensi Sekolah"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "SMP Negeri / Sistem Presensi Digital"
#define MyAppExeLauncher "launcher\Absensi-Launcher.vbs"
#define MyAppWindowLauncher "launcher\Absensi-AppWindow.vbs"
#define MyAppSilentStart "launcher\Start-Silent.vbs"
#define MyAppSilentStop "launcher\Stop-Silent.vbs"

[Setup]
AppId={{8D4F62B1-79B3-4F2C-9E6A-2A94C8F10401}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} v{#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={sd}\AbsensiSekolah
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
AllowNoIcons=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=..\release
OutputBaseFilename=Setup-Absensi-Sekolah-v{#MyAppVersion}
SetupIconFile=..\assets\app-icon.ico
UninstallDisplayIcon={app}\assets\app-icon.ico
Compression=lzma2/normal
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
CloseApplications=yes

[Languages]
Name: "id"; MessagesFile: "compiler:Default.isl"

[Messages]
SetupWindowTitle=Instalasi {#MyAppName} v{#MyAppVersion}
WelcomeLabel1=Selamat Datang di Instalasi {#MyAppName}
WelcomeLabel2=Program ini akan memasang {#MyAppName} beserta server localhost mandiri ke komputer Anda (seperti aplikasi Dapodik / e-Rapor).%n%nSetelah terpasang, aplikasi dapat langsung dibuka melalui ikon Desktop secara lokal maupun melalui jaringan WiFi/LAN sekolah.%n%nKlik Lanjut (Next) untuk melanjutkan.
SelectDirLabel3=Setup akan memasang {#MyAppName} ke folder berikut.
FinishedHeadingLabel=Instalasi {#MyAppName} Selesai
FinishedLabel=Aplikasi telah terpasang di komputer Anda. Server localhost akan berjalan otomatis di latar belakang tanpa jendela CMD terbuka.

[Tasks]
Name: "desktopicon"; Description: "Buat ikon pintasan di Desktop (Buka di Browser)"; GroupDescription: "Ikon Pintasan:"; Flags: checkedonce
Name: "appwindowicon"; Description: "Buat ikon Mode Jendela Aplikasi (Standalone App Window)"; GroupDescription: "Ikon Pintasan:"; Flags: unchecked
Name: "autostart"; Description: "Jalankan server localhost otomatis saat Windows menyala (seperti Dapodik)"; GroupDescription: "Layanan Latar Belakang:"; Flags: checkedonce

[Dirs]
Name: "{app}\data"; Permissions: users-modify

[Files]
Source: "..\release\AbsensiSekolah-Portable\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "\data\*,\.env"

[Icons]
Name: "{autodesktop}\{#MyAppName}"; Filename: "wscript.exe"; Parameters: """{app}\{#MyAppExeLauncher}"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\app-icon.ico"; Comment: "Buka Aplikasi Sistem Absensi Sekolah (Localhost)"; Tasks: desktopicon
Name: "{autodesktop}\{#MyAppName} (App Mode)"; Filename: "wscript.exe"; Parameters: """{app}\{#MyAppWindowLauncher}"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\app-icon.ico"; Comment: "Buka Sistem Absensi Sekolah dalam jendela aplikasi"; Tasks: appwindowicon
Name: "{group}\Buka {#MyAppName}"; Filename: "wscript.exe"; Parameters: """{app}\{#MyAppExeLauncher}"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\app-icon.ico"
Name: "{group}\Mode Jendela Aplikasi"; Filename: "wscript.exe"; Parameters: """{app}\{#MyAppWindowLauncher}"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\app-icon.ico"
Name: "{group}\Cek Status Server Localhost"; Filename: "{app}\status-localhost.bat"; WorkingDir: "{app}"; IconFilename: "{app}\assets\app-icon.ico"
Name: "{group}\Hentikan Server Localhost"; Filename: "wscript.exe"; Parameters: """{app}\{#MyAppSilentStop}"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\app-icon.ico"
Name: "{group}\Folder Database Lokal"; Filename: "{app}\data"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "SistemAbsensiSekolah"; ValueData: "wscript.exe ""{app}\{#MyAppSilentStart}"""; Flags: uninsdeletevalue; Tasks: autostart

[Run]
Filename: "wscript.exe"; Parameters: """{app}\{#MyAppSilentStart}"""; WorkingDir: "{app}"; Flags: nowait runhidden
Filename: "wscript.exe"; Parameters: """{app}\{#MyAppExeLauncher}"""; WorkingDir: "{app}"; Description: "Jalankan & Buka {#MyAppName} sekarang"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "cmd.exe"; Parameters: "/c if exist ""{app}\runtime\node.exe"" (""{app}\runtime\node.exe"" ""{app}\localhost-daemon.mjs"" stop) else (node ""{app}\localhost-daemon.mjs"" stop)"; WorkingDir: "{app}"; Flags: runhidden; RunOnceId: "StopAbsensiServer"

[Code]
var
  PortPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  PortPage := CreateInputQueryPage(
    wpSelectDir,
    'Konfigurasi Port Localhost',
    'Tentukan nomor port lokal untuk menjalankan server Sistem Absensi Sekolah.',
    'Default adalah 4500 (atau ganti misalnya 4040 / 8080 agar tidak bentrok dengan aplikasi lain seperti Dapodik 5774 atau e-Rapor 8154).'
  );
  PortPage.Add('Port Server Localhost:', False);
  PortPage.Values[0] := '4500';
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  PortNum: Integer;
begin
  Result := True;
  if CurPageID = PortPage.ID then
  begin
    PortNum := StrToIntDef(Trim(PortPage.Values[0]), -1);
    if (PortNum < 1024) or (PortNum > 65535) then
    begin
      MsgBox('Masukkan angka port yang valid antara 1024 sampai 65535 (contoh: 4500 atau 4040).', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

procedure WriteDefaultEnvIfNeeded;
var
  EnvFile: String;
  PortStr: String;
  Content: String;
begin
  EnvFile := ExpandConstant('{app}\.env');
  if not FileExists(EnvFile) then
  begin
    PortStr := Trim(PortPage.Values[0]);
    if PortStr = '' then PortStr := '4500';
    Content :=
      '# Pengaturan Otomatis Installer Sistem Absensi Sekolah' + #13#10 +
      'LOCALHOST_PORT=' + PortStr + #13#10 +
      '# Kosongkan DATABASE_URL / TURSO jika memakai Database Lokal Offline (default)' + #13#10;
    SaveStringToFile(EnvFile, Content, False);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    WriteDefaultEnvIfNeeded;
  end;
end;
