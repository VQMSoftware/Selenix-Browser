!macro customInstall
  WriteRegStr SHCTX "SOFTWARE\RegisteredApplications" "selenix" "Software\Clients\StartMenuInternet\selenix\Capabilities"

  WriteRegStr SHCTX "SOFTWARE\Classes\selenix" "" "selenix HTML Document"
  WriteRegStr SHCTX "SOFTWARE\Classes\selenix\Application" "AppUserModelId" "selenix"
  WriteRegStr SHCTX "SOFTWARE\Classes\selenix\Application" "ApplicationIcon" "$INSTDIR\selenix.exe,0"
  WriteRegStr SHCTX "SOFTWARE\Classes\selenix\Application" "ApplicationName" "selenix"
  WriteRegStr SHCTX "SOFTWARE\Classes\selenix\Application" "ApplicationCompany" "selenix"      
  WriteRegStr SHCTX "SOFTWARE\Classes\selenix\Application" "ApplicationDescription" "A privacy-focused, extensible and beautiful web browser"      
  WriteRegStr SHCTX "SOFTWARE\Classes\selenix\DefaultIcon" "DefaultIcon" "$INSTDIR\selenix.exe,0"
  WriteRegStr SHCTX "SOFTWARE\Classes\selenix\shell\open\command" "" '"$INSTDIR\selenix.exe" "%1"'

  WriteRegStr SHCTX "SOFTWARE\Classes\.htm\OpenWithProgIds" "selenix" ""
  WriteRegStr SHCTX "SOFTWARE\Classes\.html\OpenWithProgIds" "selenix" ""

  WriteRegStr SHCTX "SOFTWARE\Clients\StartMenuInternet\selenix" "" "selenix"
  WriteRegStr SHCTX "SOFTWARE\Clients\StartMenuInternet\selenix\DefaultIcon" "" "$INSTDIR\selenix.exe,0"
  WriteRegStr SHCTX "SOFTWARE\Clients\StartMenuInternet\selenix\Capabilities" "ApplicationDescription" "A privacy-focused, extensible and beautiful web browser"
  WriteRegStr SHCTX "SOFTWARE\Clients\StartMenuInternet\selenix\Capabilities" "ApplicationName" "selenix"
  WriteRegStr SHCTX "SOFTWARE\Clients\StartMenuInternet\selenix\Capabilities" "ApplicationIcon" "$INSTDIR\selenix.exe,0"
  WriteRegStr SHCTX "SOFTWARE\Clients\StartMenuInternet\selenix\Capabilities\FileAssociations" ".htm" "selenix"
  WriteRegStr SHCTX "SOFTWARE\Clients\StartMenuInternet\selenix\Capabilities\FileAssociations" ".html" "selenix"
  WriteRegStr SHCTX "SOFTWARE\Clients\StartMenuInternet\selenix\Capabilities\URLAssociations" "http" "selenix"
  WriteRegStr SHCTX "SOFTWARE\Clients\StartMenuInternet\selenix\Capabilities\URLAssociations" "https" "selenix"
  WriteRegStr SHCTX "SOFTWARE\Clients\StartMenuInternet\selenix\Capabilities\StartMenu" "StartMenuInternet" "selenix"
  
  WriteRegDWORD SHCTX "SOFTWARE\Clients\StartMenuInternet\selenix\InstallInfo" "IconsVisible" 1
  
  WriteRegStr SHCTX "SOFTWARE\Clients\StartMenuInternet\selenix\shell\open\command" "" "$INSTDIR\selenix.exe"
!macroend
!macro customUnInstall
  DeleteRegKey SHCTX "SOFTWARE\Classes\selenix"
  DeleteRegKey SHCTX "SOFTWARE\Clients\StartMenuInternet\selenix"
  DeleteRegValue SHCTX "SOFTWARE\RegisteredApplications" "selenix"
!macroend