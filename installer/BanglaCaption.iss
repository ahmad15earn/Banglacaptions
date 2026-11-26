; Inno Setup script - builds BanglaCaption-Setup-<version>.exe
#ifndef AppVersion
  #define AppVersion "0.4.0"
#endif

[Setup]
AppId={{6F2B8C1E-4D3A-4E5B-9A71-BC0A5E1C2D90}
AppName=Bangla Caption
AppVersion={#AppVersion}
AppPublisher=Bangla Caption contributors
DefaultDirName={autopf}\Bangla Caption
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist
OutputBaseFilename=BanglaCaption-Setup-{#AppVersion}
SetupIconFile=..\assets\icon.ico
UninstallDisplayIcon={app}\assets\icon.ico
LicenseFile=..\LICENSE
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Files]
Source: "..\panel\BanglaCaption.jsx"; DestDir: "{app}\panel"; Flags: ignoreversion
Source: "..\worker\bangla_caption_worker.py"; DestDir: "{app}\worker"; Flags: ignoreversion
Source: "..\assets\*"; DestDir: "{app}\assets"; Flags: ignoreversion
Source: "..\tools\setup_engine.bat"; DestDir: "{app}\tools"; Flags: ignoreversion
Source: "..\tools\ae_prefs.ps1"; DestDir: "{app}\tools"; Flags: ignoreversion
Source: "..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion

[Run]
; runs as the normal user so the engine lands in that user's %APPDATA%
Filename: "{app}\tools\setup_engine.bat"; Parameters: """{app}"""; StatusMsg: "Installing speech engines (large download, please wait)..."; Flags: runasoriginaluser waituntilterminated

[UninstallDelete]
Type: filesandordirs; Name: "{userappdata}\BanglaCaption"

[Code]
procedure CopyPanelToAfterEffects;
var
  Base, Dir, Src: String;
  FR: TFindRec;
  Count: Integer;
begin
  Base := ExpandConstant('{autopf}\Adobe\');
  Src := ExpandConstant('{app}\panel\BanglaCaption.jsx');
  Count := 0;
  if FindFirst(Base + 'Adobe After Effects*', FR) then
  begin
    try
      repeat
        if (FR.Attributes and FILE_ATTRIBUTE_DIRECTORY) <> 0 then
        begin
          Dir := Base + FR.Name + '\Support Files\Scripts\ScriptUI Panels';
          if DirExists(Dir) then
            if FileCopy(Src, Dir + '\BanglaCaption.jsx', False) then
              Count := Count + 1;
        end;
      until not FindNext(FR);
    finally
      FindClose(FR);
    end;
  end;
  if Count = 0 then
    MsgBox('No After Effects installation was found under ' + Base + '.' + #13#10 +
           'Copy ' + Src + ' into the "Scripts\ScriptUI Panels" folder of your After Effects manually.',
           mbInformation, MB_OK);
end;

procedure RemovePanelFromAfterEffects;
var
  Base, F: String;
  FR: TFindRec;
begin
  Base := ExpandConstant('{autopf}\Adobe\');
  if FindFirst(Base + 'Adobe After Effects*', FR) then
  begin
    try
      repeat
        F := Base + FR.Name + '\Support Files\Scripts\ScriptUI Panels\BanglaCaption.jsx';
        if FileExists(F) then DeleteFile(F);
      until not FindNext(FR);
    finally
      FindClose(FR);
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then CopyPanelToAfterEffects;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then RemovePanelFromAfterEffects;
end;
