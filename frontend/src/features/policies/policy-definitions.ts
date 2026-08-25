// Policy definitions for the visual editor
// Maps UI categories/fields to Google Android Management API policy_json keys
// Reference: https://developers.google.com/android/management/reference/rest/v1/enterprises.policies

export interface PolicyFieldOption {
  value: string;
  label: string;
}

export interface PolicyFieldBase {
  key: string; // dot-notation path in policy_json (e.g. "advancedSecurityOverrides.developerSettings")
  label: string;
  description: string;
}

export interface PolicyToggleField extends PolicyFieldBase {
  type: "toggle";
  inverted?: boolean; // true = UI "ON" means JSON value is false (for *Disabled flags)
}

export interface PolicySelectField extends PolicyFieldBase {
  type: "select";
  options: PolicyFieldOption[];
}

export interface PolicyNumberField extends PolicyFieldBase {
  type: "number";
  min: number;
  max: number;
  step?: number;
}

export type PolicyField = PolicyToggleField | PolicySelectField | PolicyNumberField;

export interface PolicyCategory {
  id: string;
  title: string;
  icon: string; // lucide icon name
  color: string; // tailwind color class
  fields: PolicyField[];
}

export const policyCategories: PolicyCategory[] = [
  // ─────────────────────────────────────────────
  // 1. PASSWORD E BLOCCO SCHERMO
  // ─────────────────────────────────────────────
  {
    id: "password",
    title: "Password e Blocco Schermo",
    icon: "Lock",
    color: "text-amber-600 bg-amber-50",
    fields: [
      {
        key: "passwordPolicies.0.passwordMinimumLength",
        label: "Lunghezza minima password",
        description: "Numero minimo di caratteri per la password (0 = nessun requisito)",
        type: "number",
        min: 0,
        max: 16,
        step: 1,
      },
      {
        key: "passwordPolicies.0.passwordQuality",
        label: "Qualita' password",
        description: "Tipo di password richiesta per sbloccare il dispositivo",
        type: "select",
        options: [
          { value: "", label: "Non specificata" },
          { value: "BIOMETRIC_WEAK", label: "Biometrica" },
          { value: "SOMETHING", label: "Qualsiasi blocco" },
          { value: "NUMERIC", label: "Numerica" },
          { value: "NUMERIC_COMPLEX", label: "Numerica complessa" },
          { value: "ALPHABETIC", label: "Alfabetica" },
          { value: "ALPHANUMERIC", label: "Alfanumerica" },
          { value: "COMPLEX", label: "Complessa" },
        ],
      },
      {
        key: "passwordPolicies.0.passwordHistoryLength",
        label: "Cronologia password",
        description: "Numero di password precedenti che non possono essere riutilizzate",
        type: "number",
        min: 0,
        max: 50,
        step: 1,
      },
      {
        key: "passwordPolicies.0.maximumFailedPasswordsForWipe",
        label: "Tentativi prima del wipe",
        description: "Numero di tentativi falliti prima della cancellazione del dispositivo (0 = nessun limite)",
        type: "number",
        min: 0,
        max: 50,
        step: 1,
      },
      {
        key: "passwordPolicies.0.passwordExpirationTimeout",
        label: "Scadenza password",
        description: "Tempo prima che la password scada e debba essere cambiata",
        type: "select",
        options: [
          { value: "", label: "Non specificata" },
          { value: "2592000s", label: "30 giorni" },
          { value: "5184000s", label: "60 giorni" },
          { value: "7776000s", label: "90 giorni" },
          { value: "15552000s", label: "180 giorni" },
          { value: "31536000s", label: "365 giorni" },
        ],
      },
      {
        key: "maximumTimeToLock",
        label: "Tempo max inattivita'",
        description: "Tempo massimo prima del blocco automatico dello schermo",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "30000", label: "30 secondi" },
          { value: "60000", label: "1 minuto" },
          { value: "120000", label: "2 minuti" },
          { value: "300000", label: "5 minuti" },
          { value: "600000", label: "10 minuti" },
          { value: "1800000", label: "30 minuti" },
        ],
      },
      {
        key: "keyguardDisabled",
        label: "Disabilita lock screen",
        description: "Rimuove la schermata di blocco (solo dispositivi dedicati)",
        type: "toggle",
        inverted: false,
      },
      {
        key: "keyguardDisabledFeatures",
        label: "Funzioni lock screen disabilitate",
        description: "Quali funzioni disabilitare nella schermata di blocco",
        type: "select",
        options: [
          { value: "", label: "Nessuna" },
          { value: "CAMERA", label: "Fotocamera" },
          { value: "NOTIFICATIONS", label: "Notifiche" },
          { value: "UNREDACTED_NOTIFICATIONS", label: "Notifiche non oscurate" },
          { value: "TRUST_AGENTS", label: "Agenti di fiducia" },
          { value: "DISABLE_FINGERPRINT", label: "Impronta digitale" },
          { value: "DISABLE_FACE", label: "Riconoscimento facciale" },
          { value: "DISABLE_IRIS", label: "Iride" },
          { value: "SHORTCUTS", label: "Scorciatoie" },
          { value: "ALL_FEATURES", label: "Tutte le funzioni" },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 2. SICUREZZA
  // ─────────────────────────────────────────────
  {
    id: "security",
    title: "Sicurezza",
    icon: "ShieldCheck",
    color: "text-red-600 bg-red-50",
    fields: [
      {
        key: "cameraAccess",
        label: "Accesso fotocamera",
        description: "Controlla l'accesso alla fotocamera del dispositivo",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "CAMERA_ACCESS_UNSPECIFIED", label: "Default sistema" },
          { value: "CAMERA_ALLOWED", label: "Permesso" },
          { value: "CAMERA_DISABLED", label: "Disabilitato" },
        ],
      },
      {
        key: "microphoneAccess",
        label: "Accesso microfono",
        description: "Controlla l'accesso al microfono (solo fully managed)",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "MICROPHONE_ACCESS_UNSPECIFIED", label: "Default sistema" },
          { value: "MICROPHONE_ALLOWED", label: "Permesso" },
          { value: "MICROPHONE_DISABLED", label: "Disabilitato" },
        ],
      },
      {
        key: "screenCaptureDisabled",
        label: "Screenshot",
        description: "Permetti di catturare screenshot dello schermo",
        type: "toggle",
        inverted: true,
      },
      {
        key: "encryptionPolicy",
        label: "Crittografia",
        description: "Politica di crittografia del dispositivo",
        type: "select",
        options: [
          { value: "", label: "Non specificata" },
          { value: "ENABLED_WITHOUT_PASSWORD", label: "Abilitata (senza password)" },
          { value: "ENABLED_WITH_PASSWORD", label: "Abilitata (con password)" },
        ],
      },
      {
        key: "factoryResetDisabled",
        label: "Factory Reset",
        description: "Permetti il ripristino ai dati di fabbrica",
        type: "toggle",
        inverted: true,
      },
      {
        key: "advancedSecurityOverrides.developerSettings",
        label: "Opzioni sviluppatore",
        description: "Accesso alle impostazioni sviluppatore Android",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "DEVELOPER_SETTINGS_ALLOWED", label: "Permesse" },
          { value: "DEVELOPER_SETTINGS_DISABLED", label: "Disabilitate" },
        ],
      },
      {
        key: "advancedSecurityOverrides.untrustedAppsPolicy",
        label: "App non attendibili",
        description: "Politica per l'installazione di app da fonti sconosciute",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "ALLOW_INSTALL_IN_PERSONAL_PROFILE_ONLY", label: "Solo profilo personale" },
          { value: "DISALLOW_INSTALL", label: "Non consentire" },
        ],
      },
      {
        key: "advancedSecurityOverrides.googlePlayProtectVerifyApps",
        label: "Google Play Protect",
        description: "Verifica delle app tramite Google Play Protect",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "VERIFY_APPS_ENFORCED", label: "Forzato" },
          { value: "VERIFY_APPS_USER_CHOICE", label: "Scelta utente" },
        ],
      },
      {
        key: "advancedSecurityOverrides.commonCriteriaMode",
        label: "Modalita' Common Criteria",
        description: "Abilita il modo Common Criteria per conformita' di sicurezza avanzata (Android 11+)",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "COMMON_CRITERIA_MODE_DISABLED", label: "Disabilitata" },
          { value: "COMMON_CRITERIA_MODE_ENABLED", label: "Abilitata" },
        ],
      },
      {
        key: "advancedSecurityOverrides.mtePolicy",
        label: "Memory Tagging Extension",
        description: "Controllo MTE (Memory Tagging Extension) per la sicurezza della memoria (Android 14+)",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "MTE_USER_CHOICE", label: "Scelta utente" },
          { value: "MTE_ENFORCED", label: "Forzata" },
          { value: "MTE_DISABLED", label: "Disabilitata" },
        ],
      },
      {
        key: "advancedSecurityOverrides.contentProtectionPolicy",
        label: "Protezione contenuti",
        description: "Protezione dei contenuti tramite scansione app ingannevoli (Android 15+)",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "CONTENT_PROTECTION_DISABLED", label: "Disabilitata" },
          { value: "CONTENT_PROTECTION_ENABLED", label: "Abilitata" },
        ],
      },
      {
        key: "credentialsConfigDisabled",
        label: "Configurazione credenziali",
        description: "Permetti la configurazione delle credenziali utente",
        type: "toggle",
        inverted: true,
      },
      {
        key: "credentialProviderPolicyDefault",
        label: "Provider credenziali",
        description: "Permetti alle app di agire come provider di credenziali (Android 14+)",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "CREDENTIAL_PROVIDER_ALLOWED", label: "Permesso" },
          { value: "CREDENTIAL_PROVIDER_DISALLOWED", label: "Non consentito" },
        ],
      },
      {
        key: "minimumApiLevel",
        label: "Livello API minimo",
        description: "Versione minima di Android richiesta (es. 28 = Android 9, 33 = Android 13)",
        type: "number",
        min: 0,
        max: 36,
        step: 1,
      },
      {
        key: "networkEscapeHatchEnabled",
        label: "Escape hatch di rete",
        description: "Permetti connessione temporanea alla rete all'avvio se la rete configurata non e' disponibile",
        type: "toggle",
        inverted: false,
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 3. RETE E CONNETTIVITA'
  // ─────────────────────────────────────────────
  {
    id: "network",
    title: "Rete e Connettivita'",
    icon: "Wifi",
    color: "text-blue-600 bg-blue-50",
    fields: [
      // --- WiFi ---
      {
        key: "deviceConnectivityManagement.configureWifi",
        label: "Configurazione WiFi",
        description: "Controlla se l'utente puo' configurare reti WiFi",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "ALLOW_CONFIGURING_WIFI", label: "Permessa" },
          { value: "DISALLOW_CONFIGURING_WIFI", label: "Non consentita" },
          { value: "DISALLOW_ADD_WIFI_CONFIG", label: "Blocca aggiunta nuove reti" },
        ],
      },
      {
        key: "deviceRadioState.wifiState",
        label: "Stato WiFi",
        description: "Forza l'attivazione o disattivazione del WiFi (Android 13+)",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "WIFI_STATE_USER_CHOICE", label: "Scelta utente" },
          { value: "WIFI_ENABLED", label: "Sempre attivo" },
          { value: "WIFI_DISABLED", label: "Sempre disattivato" },
        ],
      },
      {
        key: "deviceConnectivityManagement.wifiDirectSettings",
        label: "WiFi Direct",
        description: "Connessioni WiFi peer-to-peer senza router",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "WIFI_DIRECT_ALLOWED", label: "Permesso" },
          { value: "WIFI_DIRECT_DISALLOWED", label: "Non consentito" },
        ],
      },
      {
        key: "deviceRadioState.minimumWifiSecurityLevel",
        label: "Sicurezza WiFi minima",
        description: "Livello minimo di sicurezza per le reti WiFi a cui collegarsi",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "OPEN_NETWORK_SECURITY", label: "Reti aperte (nessuno)" },
          { value: "PERSONAL_NETWORK_SECURITY", label: "Personale (WEP, WPA)" },
          { value: "ENTERPRISE_NETWORK_SECURITY", label: "Enterprise (EAP)" },
          { value: "ENTERPRISE_BIT192_NETWORK_SECURITY", label: "Enterprise 192-bit" },
        ],
      },
      // --- USB ---
      {
        key: "deviceConnectivityManagement.usbDataAccess",
        label: "Trasferimento dati USB",
        description: "Controlla il trasferimento dati tramite USB",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "ALLOW_USB_DATA_TRANSFER", label: "Permesso" },
          { value: "DISALLOW_USB_FILE_TRANSFER", label: "Blocca file" },
          { value: "DISALLOW_USB_DATA_TRANSFER", label: "Blocca tutto" },
        ],
      },
      // --- Tethering ---
      {
        key: "deviceConnectivityManagement.tetheringSettings",
        label: "Tethering",
        description: "Controlla le impostazioni di tethering (hotspot)",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "ALLOW_ALL_TETHERING", label: "Tutto permesso" },
          { value: "DISALLOW_WIFI_TETHERING", label: "Blocca WiFi tethering" },
          { value: "DISALLOW_ALL_TETHERING", label: "Blocca tutto" },
        ],
      },
      // --- Bluetooth ---
      {
        key: "bluetoothDisabled",
        label: "Bluetooth",
        description: "Permetti l'uso del Bluetooth",
        type: "toggle",
        inverted: true,
      },
      {
        key: "bluetoothConfigDisabled",
        label: "Configurazione Bluetooth",
        description: "Permetti la modifica delle impostazioni Bluetooth",
        type: "toggle",
        inverted: true,
      },
      {
        key: "bluetoothContactSharingDisabled",
        label: "Condivisione contatti Bluetooth",
        description: "Permetti la sincronizzazione dei contatti via Bluetooth (es. vivavoce auto)",
        type: "toggle",
        inverted: true,
      },
      {
        key: "deviceConnectivityManagement.bluetoothSharing",
        label: "Condivisione file Bluetooth",
        description: "Permetti l'invio di file tramite Bluetooth",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "BLUETOOTH_SHARING_ALLOWED", label: "Permessa" },
          { value: "BLUETOOTH_SHARING_DISALLOWED", label: "Non consentita" },
        ],
      },
      // --- VPN ---
      {
        key: "vpnConfigDisabled",
        label: "Configurazione VPN",
        description: "Permetti la configurazione di connessioni VPN",
        type: "toggle",
        inverted: true,
      },
      // --- NFC ---
      {
        key: "outgoingBeamDisabled",
        label: "NFC Beam",
        description: "Permetti il trasferimento dati tramite NFC",
        type: "toggle",
        inverted: true,
      },
      // --- Reti mobili ---
      {
        key: "dataRoamingDisabled",
        label: "Roaming dati",
        description: "Permetti il roaming dati mobile",
        type: "toggle",
        inverted: true,
      },
      {
        key: "mobileNetworksConfigDisabled",
        label: "Configurazione reti mobili",
        description: "Permetti la configurazione delle reti mobili (APN, ecc.)",
        type: "toggle",
        inverted: true,
      },
      {
        key: "cellBroadcastsConfigDisabled",
        label: "Cell Broadcast",
        description: "Permetti la configurazione dei messaggi di trasmissione cellulare",
        type: "toggle",
        inverted: true,
      },
      {
        key: "networkResetDisabled",
        label: "Reset impostazioni di rete",
        description: "Permetti il ripristino delle impostazioni di rete (WiFi, dati mobili, Bluetooth)",
        type: "toggle",
        inverted: true,
      },
      {
        key: "deviceRadioState.airplaneModeState",
        label: "Modalita' aereo",
        description: "Controlla la modalita' aereo (Android 9+)",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "AIRPLANE_MODE_USER_CHOICE", label: "Scelta utente" },
          { value: "AIRPLANE_MODE_DISABLED", label: "Non consentita" },
        ],
      },
      {
        key: "deviceRadioState.ultraWidebandState",
        label: "Ultra-Wideband (UWB)",
        description: "Stato della radio UWB (Android 14+)",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "ULTRA_WIDEBAND_USER_CHOICE", label: "Scelta utente" },
          { value: "ULTRA_WIDEBAND_DISABLED", label: "Disabilitato" },
        ],
      },
      {
        key: "deviceRadioState.cellularTwoGState",
        label: "Rete 2G",
        description: "Controlla la connessione alla rete 2G (Android 14+)",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "CELLULAR_TWO_G_USER_CHOICE", label: "Scelta utente" },
          { value: "CELLULAR_TWO_G_DISABLED", label: "Disabilitato" },
        ],
      },
      // --- Localizzazione ---
      {
        key: "locationMode",
        label: "Localizzazione",
        description: "Modalita' di localizzazione del dispositivo",
        type: "select",
        options: [
          { value: "", label: "Non specificata" },
          { value: "LOCATION_USER_CHOICE", label: "Scelta utente" },
          { value: "LOCATION_ENFORCED", label: "Sempre attiva" },
          { value: "LOCATION_DISABLED", label: "Disabilitata" },
        ],
      },
      {
        key: "shareLocationDisabled",
        label: "Condivisione posizione",
        description: "Permetti la condivisione della posizione",
        type: "toggle",
        inverted: true,
      },
      // --- eSIM ---
      {
        key: "deviceRadioState.userInitiatedAddEsimSettings",
        label: "Aggiunta eSIM",
        description: "Permetti all'utente di aggiungere eSIM (Android 14+)",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "ALLOW_ADDING_ESIM", label: "Permessa" },
          { value: "DISALLOW_ADDING_ESIM", label: "Non consentita" },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 4. APPLICAZIONI
  // ─────────────────────────────────────────────
  {
    id: "apps",
    title: "Applicazioni",
    icon: "AppWindow",
    color: "text-green-600 bg-green-50",
    fields: [
      {
        key: "playStoreMode",
        label: "Modalita' Play Store",
        description: "Controlla la visibilita' delle app nel Play Store",
        type: "select",
        options: [
          { value: "", label: "Non specificata" },
          { value: "WHITELIST", label: "Solo app approvate" },
          { value: "BLACKLIST", label: "Tutte tranne bloccate" },
        ],
      },
      {
        key: "defaultPermissionPolicy",
        label: "Permessi di default",
        description: "Politica predefinita per i permessi runtime richiesti dalle app",
        type: "select",
        options: [
          { value: "", label: "Non specificata" },
          { value: "PROMPT", label: "Chiedi all'utente" },
          { value: "GRANT", label: "Concedi automaticamente" },
          { value: "DENY", label: "Nega automaticamente" },
        ],
      },
      {
        key: "appAutoUpdatePolicy",
        label: "Aggiornamento auto app",
        description: "Quando aggiornare automaticamente le applicazioni",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "CHOICE_TO_THE_USER", label: "Scelta utente" },
          { value: "NEVER", label: "Mai" },
          { value: "WIFI_ONLY", label: "Solo con WiFi" },
          { value: "ALWAYS", label: "Sempre" },
        ],
      },
      {
        key: "installAppsDisabled",
        label: "Installazione app",
        description: "Permetti l'installazione di nuove applicazioni",
        type: "toggle",
        inverted: true,
      },
      {
        key: "uninstallAppsDisabled",
        label: "Disinstallazione app",
        description: "Permetti la rimozione delle applicazioni",
        type: "toggle",
        inverted: true,
      },
      {
        key: "skipFirstUseHintsEnabled",
        label: "Salta suggerimenti iniziali",
        description: "Salta i tutorial e suggerimenti al primo avvio delle app",
        type: "toggle",
        inverted: false,
      },
      {
        key: "assistContentPolicy",
        label: "Assist Content",
        description: "Controlla la condivisione dello schermo con l'assistente digitale (Android 15+)",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "ASSIST_CONTENT_ALLOWED", label: "Permesso" },
          { value: "ASSIST_CONTENT_DISALLOWED", label: "Non consentito" },
        ],
      },
      {
        key: "appFunctions",
        label: "Funzioni app",
        description: "Controlla l'esposizione delle funzioni app nell'ecosistema Android (Android 15+)",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "APP_FUNCTIONS_ALLOWED", label: "Permesse" },
          { value: "APP_FUNCTIONS_DISALLOWED", label: "Non consentite" },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 5. FUNZIONALITA' DISPOSITIVO
  // ─────────────────────────────────────────────
  {
    id: "device",
    title: "Funzionalita' Dispositivo",
    icon: "Smartphone",
    color: "text-purple-600 bg-purple-50",
    fields: [
      {
        key: "adjustVolumeDisabled",
        label: "Regolazione volume",
        description: "Permetti all'utente di regolare il volume",
        type: "toggle",
        inverted: true,
      },
      {
        key: "outgoingCallsDisabled",
        label: "Chiamate in uscita",
        description: "Permetti le chiamate telefoniche in uscita",
        type: "toggle",
        inverted: true,
      },
      {
        key: "smsDisabled",
        label: "SMS",
        description: "Permetti l'invio e ricezione di SMS",
        type: "toggle",
        inverted: true,
      },
      {
        key: "modifyAccountsDisabled",
        label: "Modifica account",
        description: "Permetti di aggiungere o rimuovere account",
        type: "toggle",
        inverted: true,
      },
      {
        key: "addUserDisabled",
        label: "Aggiunta utenti",
        description: "Permetti la creazione di nuovi utenti o profili",
        type: "toggle",
        inverted: true,
      },
      {
        key: "removeUserDisabled",
        label: "Rimozione utenti",
        description: "Permetti la rimozione di utenti dal dispositivo",
        type: "toggle",
        inverted: true,
      },
      {
        key: "mountPhysicalMediaDisabled",
        label: "Media fisici (SD)",
        description: "Permetti il montaggio di schede SD e altri media esterni",
        type: "toggle",
        inverted: true,
      },
      {
        key: "printingPolicy",
        label: "Stampa",
        description: "Controlla la possibilita' di stampare dal dispositivo (Android 9+)",
        type: "select",
        options: [
          { value: "", label: "Non specificata" },
          { value: "PRINTING_ALLOWED", label: "Permessa" },
          { value: "PRINTING_DISALLOWED", label: "Non consentita" },
        ],
      },
      {
        key: "setWallpaperDisabled",
        label: "Cambio sfondo",
        description: "Permetti di cambiare lo sfondo del dispositivo",
        type: "toggle",
        inverted: true,
      },
      {
        key: "setUserIconDisabled",
        label: "Cambio icona utente",
        description: "Permetti la modifica dell'icona/avatar utente (Android 7+)",
        type: "toggle",
        inverted: true,
      },
      {
        key: "createWindowsDisabled",
        label: "Finestre popup",
        description: "Permetti la creazione di finestre non-app (alert, overlay)",
        type: "toggle",
        inverted: true,
      },
      {
        key: "funDisabled",
        label: "Easter egg",
        description: "Permetti l'accesso al gioco Easter egg nelle impostazioni",
        type: "toggle",
        inverted: true,
      },
      {
        key: "privateKeySelectionEnabled",
        label: "Selezione chiave privata",
        description: "Mostra l'interfaccia per la selezione manuale della chiave privata",
        type: "toggle",
        inverted: false,
      },
      {
        key: "stayOnPluggedModes",
        label: "Schermo acceso quando in carica",
        description: "Mantieni lo schermo acceso quando il dispositivo e' in carica",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "AC", label: "Solo caricatore AC" },
          { value: "USB", label: "Solo USB" },
          { value: "WIRELESS", label: "Solo wireless" },
        ],
      },
      {
        key: "enterpriseDisplayNameVisibility",
        label: "Nome azienda visibile",
        description: "Mostra il nome dell'azienda (enterprise) sul dispositivo",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "ENTERPRISE_DISPLAY_NAME_SHOWN", label: "Visibile" },
          { value: "ENTERPRISE_DISPLAY_NAME_HIDDEN", label: "Nascosto" },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 6. DISPLAY E SCHERMO
  // ─────────────────────────────────────────────
  {
    id: "display",
    title: "Display e Schermo",
    icon: "Monitor",
    color: "text-cyan-600 bg-cyan-50",
    fields: [
      {
        key: "displaySettings.screenBrightnessSettings.screenBrightnessMode",
        label: "Modalita' luminosita'",
        description: "Controlla come viene gestita la luminosita' dello schermo (Android 9+)",
        type: "select",
        options: [
          { value: "", label: "Non specificata" },
          { value: "BRIGHTNESS_USER_CHOICE", label: "Scelta utente" },
          { value: "BRIGHTNESS_AUTOMATIC", label: "Automatica" },
          { value: "BRIGHTNESS_FIXED", label: "Fissa" },
        ],
      },
      {
        key: "displaySettings.screenBrightnessSettings.screenBrightness",
        label: "Livello luminosita'",
        description: "Livello di luminosita' fisso dello schermo (0-255, solo se modalita' fissa)",
        type: "number",
        min: 0,
        max: 255,
        step: 5,
      },
      {
        key: "displaySettings.screenTimeoutSettings.screenTimeoutMode",
        label: "Modalita' timeout schermo",
        description: "Controlla il timeout dello schermo (Android 9+)",
        type: "select",
        options: [
          { value: "", label: "Non specificata" },
          { value: "SCREEN_TIMEOUT_USER_CHOICE", label: "Scelta utente" },
          { value: "SCREEN_TIMEOUT_ENFORCED", label: "Forzato" },
        ],
      },
      {
        key: "displaySettings.screenTimeoutSettings.screenTimeout",
        label: "Durata timeout schermo",
        description: "Tempo in secondi prima dello spegnimento dello schermo (solo se forzato)",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "15000", label: "15 secondi" },
          { value: "30000", label: "30 secondi" },
          { value: "60000", label: "1 minuto" },
          { value: "120000", label: "2 minuti" },
          { value: "300000", label: "5 minuti" },
          { value: "600000", label: "10 minuti" },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 7. AGGIORNAMENTI DI SISTEMA
  // ─────────────────────────────────────────────
  {
    id: "updates",
    title: "Aggiornamenti di Sistema",
    icon: "RefreshCw",
    color: "text-teal-600 bg-teal-50",
    fields: [
      {
        key: "systemUpdate.type",
        label: "Politica aggiornamento",
        description: "Come vengono gestiti gli aggiornamenti di sistema",
        type: "select",
        options: [
          { value: "", label: "Non specificata" },
          { value: "AUTOMATIC", label: "Automatico (appena disponibile)" },
          { value: "WINDOWED", label: "In finestra oraria (definisci orario)" },
          { value: "POSTPONE", label: "Posponi (max 30 giorni)" },
        ],
      },
      {
        key: "autoDateAndTimeZone",
        label: "Data/ora automatica",
        description: "Forza l'impostazione automatica di data, ora e fuso orario",
        type: "select",
        options: [
          { value: "", label: "Non specificata" },
          { value: "AUTO_DATE_AND_TIME_ZONE_USER_CHOICE", label: "Scelta utente" },
          { value: "AUTO_DATE_AND_TIME_ZONE_ENFORCED", label: "Forzata" },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 8. MODALITA' KIOSK
  // ─────────────────────────────────────────────
  {
    id: "kiosk",
    title: "Modalita' Kiosk",
    icon: "Monitor",
    color: "text-orange-600 bg-orange-50",
    fields: [
      {
        key: "kioskCustomLauncherEnabled",
        label: "Launcher kiosk personalizzato",
        description: "Abilita il launcher kiosk che mostra solo le app consentite",
        type: "toggle",
        inverted: false,
      },
      {
        key: "kioskCustomization.powerButtonActions",
        label: "Pulsante accensione",
        description: "Controlla il comportamento del pulsante di accensione in modalita' kiosk",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "POWER_BUTTON_AVAILABLE", label: "Disponibile" },
          { value: "POWER_BUTTON_BLOCKED", label: "Bloccato" },
        ],
      },
      {
        key: "kioskCustomization.systemErrorWarnings",
        label: "Avvisi errori di sistema",
        description: "Mostra gli avvisi di errore del sistema in modalita' kiosk",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "ERROR_AND_WARNINGS_ENABLED", label: "Visibili" },
          { value: "ERROR_AND_WARNINGS_MUTED", label: "Nascosti" },
        ],
      },
      {
        key: "kioskCustomization.systemNavigation",
        label: "Navigazione di sistema",
        description: "Visibilita' della barra di navigazione (Home, Back, Recent) in kiosk",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "NAVIGATION_ENABLED", label: "Visibile" },
          { value: "NAVIGATION_DISABLED", label: "Nascosta" },
          { value: "HOME_BUTTON_ONLY", label: "Solo tasto Home" },
        ],
      },
      {
        key: "kioskCustomization.statusBar",
        label: "Barra di stato",
        description: "Visibilita' della barra di stato (notifiche, WiFi, batteria) in kiosk",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "NOTIFICATIONS_AND_SYSTEM_INFO_ENABLED", label: "Visibile" },
          { value: "NOTIFICATIONS_AND_SYSTEM_INFO_DISABLED", label: "Nascosta" },
          { value: "SYSTEM_INFO_ONLY", label: "Solo info sistema (no notifiche)" },
        ],
      },
      {
        key: "kioskCustomization.deviceSettings",
        label: "Accesso impostazioni",
        description: "Permetti l'accesso alle impostazioni del dispositivo in kiosk",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "SETTINGS_ACCESS_ALLOWED", label: "Permesso" },
          { value: "SETTINGS_ACCESS_BLOCKED", label: "Bloccato" },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 9. PROFILO LAVORO / PERSONALE
  // ─────────────────────────────────────────────
  {
    id: "workProfile",
    title: "Profilo Lavoro / Personale",
    icon: "Users",
    color: "text-pink-600 bg-pink-50",
    fields: [
      {
        key: "crossProfilePolicies.showWorkContactsInPersonalProfile",
        label: "Contatti lavoro nel profilo personale",
        description: "Mostra i contatti del profilo lavoro nel profilo personale",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "SHOW_WORK_CONTACTS_IN_PERSONAL_PROFILE_ALLOWED", label: "Permesso" },
          { value: "SHOW_WORK_CONTACTS_IN_PERSONAL_PROFILE_DISALLOWED", label: "Non consentito" },
        ],
      },
      {
        key: "crossProfilePolicies.crossProfileCopyPaste",
        label: "Copia/Incolla tra profili",
        description: "Permetti il copia/incolla tra profilo lavoro e personale",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "COPY_FROM_WORK_TO_PERSONAL_DISALLOWED", label: "Da lavoro a personale bloccato" },
          { value: "CROSS_PROFILE_COPY_PASTE_ALLOWED", label: "Permesso in entrambe le direzioni" },
        ],
      },
      {
        key: "crossProfilePolicies.crossProfileDataSharing",
        label: "Condivisione dati tra profili",
        description: "Controlla la condivisione di dati tra profilo lavoro e personale",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "CROSS_PROFILE_DATA_SHARING_DISALLOWED", label: "Non consentita" },
          { value: "DATA_SHARING_FROM_WORK_TO_PERSONAL_DISALLOWED", label: "Da lavoro a personale bloccato" },
          { value: "CROSS_PROFILE_DATA_SHARING_ALLOWED", label: "Permessa" },
        ],
      },
      {
        key: "crossProfilePolicies.workProfileWidgetsDefault",
        label: "Widget profilo lavoro",
        description: "Permetti i widget delle app lavoro nel profilo personale",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "WORK_PROFILE_WIDGETS_DEFAULT_ALLOWED", label: "Permessi" },
          { value: "WORK_PROFILE_WIDGETS_DEFAULT_DISALLOWED", label: "Non consentiti" },
        ],
      },
      {
        key: "personalUsagePolicies.cameraDisabled",
        label: "Fotocamera profilo personale",
        description: "Permetti la fotocamera nel profilo personale",
        type: "toggle",
        inverted: true,
      },
      {
        key: "personalUsagePolicies.screenCaptureDisabled",
        label: "Screenshot profilo personale",
        description: "Permetti screenshot nel profilo personale",
        type: "toggle",
        inverted: true,
      },
      {
        key: "personalUsagePolicies.personalPlayStoreMode",
        label: "Play Store personale",
        description: "Controlla la modalita' del Play Store nel profilo personale",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "PLAY_STORE_MODE_UNSPECIFIED", label: "Default" },
          { value: "BLACKLIST", label: "Tutte tranne bloccate" },
          { value: "BLOCKLIST", label: "Lista di blocco" },
          { value: "ALLOWLIST", label: "Solo app consentite" },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 10. MONITORAGGIO E REPORT
  // ─────────────────────────────────────────────
  {
    id: "monitoring",
    title: "Monitoraggio e Report",
    icon: "BarChart3",
    color: "text-indigo-600 bg-indigo-50",
    fields: [
      {
        key: "statusReportingSettings.applicationReportsEnabled",
        label: "Report applicazioni",
        description: "Raccoglie informazioni sulle app installate e crash",
        type: "toggle",
        inverted: false,
      },
      {
        key: "statusReportingSettings.deviceSettingsEnabled",
        label: "Info dispositivo",
        description: "Raccoglie informazioni sulle impostazioni del dispositivo",
        type: "toggle",
        inverted: false,
      },
      {
        key: "statusReportingSettings.networkInfoEnabled",
        label: "Info rete",
        description: "Raccoglie informazioni sulla connettivita' di rete",
        type: "toggle",
        inverted: false,
      },
      {
        key: "statusReportingSettings.hardwareStatusEnabled",
        label: "Info hardware",
        description: "Raccoglie informazioni sullo stato dell'hardware (batteria, temperatura)",
        type: "toggle",
        inverted: false,
      },
      {
        key: "statusReportingSettings.displayInfoEnabled",
        label: "Info display",
        description: "Raccoglie informazioni sullo schermo del dispositivo",
        type: "toggle",
        inverted: false,
      },
      {
        key: "statusReportingSettings.memoryInfoEnabled",
        label: "Info memoria",
        description: "Raccoglie informazioni sull'utilizzo della memoria",
        type: "toggle",
        inverted: false,
      },
      {
        key: "statusReportingSettings.softwareInfoEnabled",
        label: "Info software",
        description: "Raccoglie informazioni sulla versione del software",
        type: "toggle",
        inverted: false,
      },
      {
        key: "statusReportingSettings.commonCriteriaModeEnabled",
        label: "Rapporto Common Criteria",
        description: "Abilita il reporting per la modalita' Common Criteria",
        type: "toggle",
        inverted: false,
      },
      {
        key: "usageLog.enabledLogTypes",
        label: "Log attivita' dispositivo",
        description: "Tipo di log di attivita' del dispositivo da raccogliere",
        type: "select",
        options: [
          { value: "", label: "Nessuno" },
          { value: "SECURITY_LOGS", label: "Log di sicurezza" },
          { value: "NETWORK_ACTIVITY_LOGS", label: "Log attivita' di rete" },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 11. PROTEZIONE FACTORY RESET (FRP)
  // ─────────────────────────────────────────────
  {
    id: "frp",
    title: "Protezione Factory Reset",
    icon: "ShieldAlert",
    color: "text-rose-600 bg-rose-50",
    fields: [
      {
        key: "wipeDataFlags",
        label: "Flag cancellazione dati",
        description: "Dati da preservare durante il wipe del dispositivo",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "PRESERVE_RESET_PROTECTION_DATA", label: "Preserva dati FRP" },
          { value: "WIPE_EXTERNAL_STORAGE", label: "Cancella storage esterno" },
        ],
      },
      {
        key: "preferentialNetworkService",
        label: "Servizio di rete preferenziale",
        description: "Controlla il servizio di rete preferenziale aziendale",
        type: "select",
        options: [
          { value: "", label: "Non specificato" },
          { value: "PREFERENTIAL_NETWORK_SERVICE_DISABLED", label: "Disabilitato" },
          { value: "PREFERENTIAL_NETWORK_SERVICE_ENABLED", label: "Abilitato" },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 12. MESSAGGI E SUPPORTO
  // ─────────────────────────────────────────────
  {
    id: "support",
    title: "Messaggi e Supporto",
    icon: "MessageSquare",
    color: "text-sky-600 bg-sky-50",
    fields: [
      {
        key: "shortSupportMessage.defaultMessage",
        label: "Messaggio breve supporto",
        description: "Messaggio breve (max 200 caratteri) mostrato quando una funzione e' disabilitata",
        type: "select",
        options: [
          { value: "", label: "Nessuno" },
        ],
      },
      {
        key: "longSupportMessage.defaultMessage",
        label: "Messaggio lungo supporto",
        description: "Messaggio dettagliato visibile nelle impostazioni dell'amministratore del dispositivo",
        type: "select",
        options: [
          { value: "", label: "Nessuno" },
        ],
      },
    ],
  },
];

// --- Policy Templates ---

export interface PolicyTemplate {
  id: string;
  nameKey: string;       // i18n key for template name
  descKey: string;       // i18n key for template description
  icon: string;          // lucide icon name
  color: string;         // tailwind classes
  defaultName: string;   // pre-filled policy name
  defaultDisplayName: string;
  formState: FormState;  // pre-configured form state
}

export const policyTemplates: PolicyTemplate[] = [
  {
    id: "gdpr",
    nameKey: "tplGdpr",
    descKey: "tplGdprDesc",
    icon: "ShieldCheck",
    color: "text-blue-700 bg-blue-100 border-blue-300 dark:text-blue-300 dark:bg-blue-900/40 dark:border-blue-700",
    defaultName: "gdpr_compliance",
    defaultDisplayName: "GDPR Compliance",
    formState: {
      // Password: min 6 chars, alphanumeric, expires 90d, lock after 5min
      "passwordPolicies.0.passwordMinimumLength": 6,
      "passwordPolicies.0.passwordQuality": "ALPHANUMERIC",
      "passwordPolicies.0.passwordExpirationTimeout": "7776000s",
      "passwordPolicies.0.passwordHistoryLength": 5,
      "passwordPolicies.0.maximumFailedPasswordsForWipe": 10,
      "maximumTimeToLock": "300000",
      // Security: encryption, no screenshots, no factory reset, no dev settings
      "encryptionPolicy": "ENABLED_WITH_PASSWORD",
      "screenCaptureDisabled": true,       // inverted toggle: UI ON = JSON false => set true = UI shows OFF for screenshots
      "factoryResetDisabled": true,        // inverted: UI shows "Factory Reset" OFF
      "advancedSecurityOverrides.developerSettings": "DEVELOPER_SETTINGS_DISABLED",
      "advancedSecurityOverrides.untrustedAppsPolicy": "DISALLOW_INSTALL",
      "advancedSecurityOverrides.googlePlayProtectVerifyApps": "VERIFY_APPS_ENFORCED",
      // Network: USB restricted, location user choice, no location sharing
      "deviceConnectivityManagement.usbDataAccess": "DISALLOW_USB_FILE_TRANSFER",
      "locationMode": "LOCATION_USER_CHOICE",
      "shareLocationDisabled": true,       // inverted: UI shows sharing OFF
      // Monitoring: all reporting ON for audit trail
      "statusReportingSettings.applicationReportsEnabled": true,
      "statusReportingSettings.deviceSettingsEnabled": true,
      "statusReportingSettings.networkInfoEnabled": true,
      "statusReportingSettings.hardwareStatusEnabled": true,
      "statusReportingSettings.softwareInfoEnabled": true,
      "statusReportingSettings.memoryInfoEnabled": true,
      "usageLog.enabledLogTypes": "SECURITY_LOGS",
      // System: auto date/time
      "autoDateAndTimeZone": "AUTO_DATE_AND_TIME_ZONE_ENFORCED",
    },
  },
  {
    id: "managed_store",
    nameKey: "tplManagedStore",
    descKey: "tplManagedStoreDesc",
    icon: "AppWindow",
    color: "text-green-700 bg-green-100 border-green-300 dark:text-green-300 dark:bg-green-900/40 dark:border-green-700",
    defaultName: "managed_play_store",
    defaultDisplayName: "Managed Play Store",
    formState: {
      // Apps: managed store, prompt permissions, auto-update wifi, no install/uninstall
      "playStoreMode": "WHITELIST",
      "defaultPermissionPolicy": "PROMPT",
      "appAutoUpdatePolicy": "WIFI_ONLY",
      "installAppsDisabled": true,         // inverted: UI shows install OFF
      "uninstallAppsDisabled": true,       // inverted: UI shows uninstall OFF
      // Security: no untrusted apps, Play Protect enforced
      "advancedSecurityOverrides.untrustedAppsPolicy": "DISALLOW_INSTALL",
      "advancedSecurityOverrides.googlePlayProtectVerifyApps": "VERIFY_APPS_ENFORCED",
      // Monitoring: app reports ON
      "statusReportingSettings.applicationReportsEnabled": true,
    },
  },
];

// --- Conversion helpers ---

/**
 * Get a nested value from an object using dot-notation path.
 * Supports array index notation: "passwordPolicies.0.passwordMinimumLength"
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Set a nested value in an object using dot-notation path.
 * Creates intermediate objects/arrays as needed.
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    if (current[part] === undefined || current[part] === null || typeof current[part] !== "object") {
      // Create array if next key is numeric, else object
      current[part] = /^\d+$/.test(nextPart) ? [] : {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Remove a nested key from an object. Cleans up empty parent objects.
 */
function removeNestedValue(obj: Record<string, unknown>, path: string): void {
  const parts = path.split(".");
  const stack: { obj: Record<string, unknown>; key: string }[] = [];
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined || typeof current[parts[i]] !== "object") return;
    stack.push({ obj: current, key: parts[i] });
    current = current[parts[i]] as Record<string, unknown>;
  }

  delete current[parts[parts.length - 1]];

  // Clean up empty parents
  for (let i = stack.length - 1; i >= 0; i--) {
    const parent = stack[i];
    const child = parent.obj[parent.key];
    if (child && typeof child === "object") {
      const keys = Array.isArray(child) ? child.filter((v) => v !== undefined) : Object.keys(child);
      if (keys.length === 0) {
        delete parent.obj[parent.key];
      }
    }
  }
}

export type FormState = Record<string, unknown>;

/**
 * Convert a policy_json object into a flat form state keyed by field paths.
 */
export function policyJsonToFormState(policyJson: Record<string, unknown>): FormState {
  const state: FormState = {};
  for (const category of policyCategories) {
    for (const field of category.fields) {
      const value = getNestedValue(policyJson, field.key);
      if (value !== undefined && value !== null) {
        if (field.type === "toggle") {
          // For inverted toggles: JSON true -> UI OFF, JSON false -> UI ON
          state[field.key] = field.inverted ? !value : !!value;
        } else if (field.type === "number") {
          state[field.key] = Number(value);
        } else {
          state[field.key] = String(value);
        }
      }
    }
  }
  return state;
}

/**
 * Convert flat form state back to a policy_json object.
 * Only includes fields that have been explicitly set (non-empty, non-default).
 */
export function formStateToPolicyJson(state: FormState): Record<string, unknown> {
  const json: Record<string, unknown> = {};
  for (const category of policyCategories) {
    for (const field of category.fields) {
      const value = state[field.key];
      if (value === undefined || value === null) continue;

      if (field.type === "toggle") {
        const boolVal = value as boolean;
        // For inverted toggles: UI ON -> JSON false, UI OFF -> JSON true
        const jsonVal = field.inverted ? !boolVal : boolVal;
        setNestedValue(json, field.key, jsonVal);
      } else if (field.type === "select") {
        const strVal = value as string;
        if (strVal !== "") {
          setNestedValue(json, field.key, strVal);
        }
      } else if (field.type === "number") {
        const numVal = Number(value);
        if (numVal > 0) {
          setNestedValue(json, field.key, numVal);
        }
      }
    }
  }

  // Handle passwordPolicies array: if index 0 exists, ensure it's wrapped in array
  if (json.passwordPolicies && typeof json.passwordPolicies === "object") {
    const pp = json.passwordPolicies as Record<string, unknown>;
    if (pp["0"] && typeof pp["0"] === "object") {
      const inner = pp["0"] as Record<string, unknown>;
      if (Object.keys(inner).length > 0) {
        json.passwordPolicies = [inner];
      } else {
        delete json.passwordPolicies;
      }
    }
  }

  return json;
}

/**
 * Merge visual editor state with any extra keys from the original policy_json
 * that aren't covered by the visual editor (e.g. applications list, custom keys).
 */
export function mergeWithExtraKeys(
  original: Record<string, unknown>,
  editorJson: Record<string, unknown>
): Record<string, unknown> {
  // Get all top-level keys managed by the editor
  const managedKeys = new Set<string>();
  for (const category of policyCategories) {
    for (const field of category.fields) {
      managedKeys.add(field.key.split(".")[0]);
    }
  }

  // Start with editor output
  const result = { ...editorJson };

  // Merge in non-managed keys from original
  for (const key of Object.keys(original)) {
    if (!managedKeys.has(key)) {
      result[key] = original[key];
    }
  }

  return result;
}
