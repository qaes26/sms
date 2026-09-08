# SMS Verifikation & WebRTC Live-Streaming Web-App

Eine moderne, produktionsbereite, mobile-first Webanwendung mit vollständiger deutscher Benutzeroberfläche, SMS-Versand über Twilio (oder anpassbare Provider), browserbasierter Kamerafreigabe und sicherem WebRTC-Echtzeitstreaming zu einem geschützten Administrationsbereich.

---

## Inhaltsverzeichnis

1. [Features & Architektur](#features--architektur)
2. [Voraussetzungen](#voraussetzungen)
3. [Installation](#1-installation-der-abhängigkeiten)
4. [Konfiguration der Umgebungsvariablen](#2-konfiguration-der-umgebungsvariablen)
5. [Konfiguration des SMS-Providers (Twilio)](#3-konfiguration-des-sms-providers)
6. [Lokale Entwicklung](#4-lokale-entwicklung)
7. [Projekt kompilieren & Build](#5-projekt-builden)
8. [Vercel Deployment](#6-bereitstellung-auf-vercel)
9. [Produktions-Domain konfigurieren](#7-produktions-domain-konfigurieren)
10. [WebRTC Signaling-Architektur auf Vercel](#8-webrtc-signaling-architektur)
11. [Zugriff auf das Admin-Dashboard](#9-zugriff-auf-das-admin-dashboard)
12. [Sicherheitsrichtlinien](#sicherheitsrichtlinien)

---

## Features & Architektur

* **Benutzerfluss (100% Deutsch)**:
  * **Schritt 1 – Willkommen**: Telefonnummerneingabe mit strenger E.164-Validierung (`libphonenumber-js`), rechtlicher Einwilligungshinweis (*„Mit dem Fortfahren stimmen Sie dem Versand einer SMS an diese Telefonnummer zu.“*).
  * **Schritt 2 – SMS-Versand**: Server-seitiger SMS-Versand mit dem exakten Text *„Unser geschätzter Kunde, Ihre Anfrage wird gerade gesendet.“*, Erfolgs- und Fehlermeldungen.
  * **Schritt 3 – Kamerafreigabe**: Separater Berechtigungsbildschirm mit *„Kamera freigeben“*. Keine verdeckte Aktivierung, transparente Browser-Zustimmung via `navigator.mediaDevices.getUserMedia()`.
  * **Schritt 4 – Kamera-Vorschau & Live-Stream**: Echtzeit-Vorschau auf dem Smartphone, Statusanzeigen (*„Kamera aktiv“* und *„Ihre Kamera wird derzeit live übertragen.“*), sowie sofortige Beendigung über *„Kamerafreigabe beenden“*.
* **Admin Dashboard (`/admin`)**:
  * Passwortgeschützt mit sicherem, serverseitigem HTTP-Only JWT-Cookie.
  * Live-Übersicht aktiver Sitzungen (*„Aktive Sitzungen“*).
  * Teilweise maskierte Telefonnummern (z. B. `+49 151 **** 5678`).
  * Live-Wiedergabe des WebRTC-Videostreams bei Auswahl einer Sitzung mit Status (*„Live“*, *„Verbunden“*, *„Verbindung wird hergestellt...“*).
  * Automatische Sitzungsbereinigung bei Verbindungsabbruch oder Schließen des Tabs.

---

## 1. Installation der Abhängigkeiten

Stellen Sie sicher, dass Node.js (Version 18+) installiert ist:

```bash
npm install
```

---

## 2. Konfiguration der Umgebungsvariablen

Erstellen Sie eine `.env.local` oder `.env`-Datei im Stammverzeichnis basierend auf `.env.example`:

```bash
cp .env.example .env.local
```

### Verfügbare Variablen

| Variable | Beschreibung | Standard / Beispiel |
| :--- | :--- | :--- |
| `SMS_PROVIDER` | Zu verwendender Provider (`twilio` für Produktion, `test` für lokale Tests) | `twilio` |
| `SMS_API_KEY` | Twilio Account SID | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `SMS_API_SECRET` | Twilio Auth Token | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `SMS_SENDER` | Verifizierte Twilio-Telefonnummer oder Alphanumeric Sender ID | `+12025550143` oder `Firmenname` |
| `ADMIN_PASSWORD` | Passwort für das Admin-Dashboard unter `/admin` | `AdminSecure2025!` |
| `ADMIN_JWT_SECRET` | Geheimer Schlüssel zum Signieren der Admin-Cookies (mind. 32 Zeichen) | Zufallsstring |

> [!NOTE]
> Für lokale Funktionstests ohne aktive Twilio-Guthaben setzen Sie `SMS_PROVIDER=test`. Im Test-Modus wird der SMS-Versand in der Konsole protokolliert.

---

## 3. Konfiguration des SMS-Providers

Für den echten SMS-Versand wird die offizielle Twilio REST API verwendet:

1. Registrieren Sie sich auf [twilio.com](https://www.twilio.com) und öffnen Sie die Twilio Konsole.
2. Kopieren Sie die **Account SID** in `SMS_API_KEY`.
3. Kopieren Sie das **Auth Token** in `SMS_API_SECRET`.
4. Richten Sie eine Telefonnummer oder eine Sender-ID ein und tragen Sie diese in `SMS_SENDER` ein (z. B. im E.164-Format `+12025550143`).
5. Setzen Sie `SMS_PROVIDER=twilio`.

Der Server versendet daraufhin bei jeder Verifikation eine echte SMS mit folgendem Text:
> *„Unser geschätzter Kunde, Ihre Anfrage wird gerade gesendet.“*

---

## 4. Lokale Entwicklung

Starten Sie den lokalen Next.js Entwicklungsserver:

```bash
npm run dev
```

Die Anwendung ist nun unter `http://localhost:3000` erreichbar.
Das Admin-Dashboard finden Sie unter `http://localhost:3000/admin`.

---

## 5. Projekt builden

Erstellen Sie den optimierten Produktions-Build:

```bash
npm run build
```

Starten Sie den Produktions-Server lokal:

```bash
npm start
```

---

## 6. Bereitstellung auf Vercel

Die Anwendung ist vollständig für das serverlose Deployment auf Vercel optimiert:

1. **Vercel CLI**:
   ```bash
   npx vercel
   ```
   oder pushen Sie den Code in ein GitHub-/GitLab-Repository und importieren Sie das Projekt in das Vercel Dashboard.

2. **Umgebungsvariablen auf Vercel hinterlegen**:
   * Gehen Sie in Vercel zu **Project Settings > Environment Variables**.
   * Fügen Sie folgende Variablen hinzu:
     * `SMS_PROVIDER`: `twilio`
     * `SMS_API_KEY`: Ihre Twilio Account SID
     * `SMS_API_SECRET`: Ihr Twilio Auth Token
     * `SMS_SENDER`: Ihre Twilio Absendernummer
     * `ADMIN_PASSWORD`: Ein starkes Passwort
     * `ADMIN_JWT_SECRET`: Ein zufälliger Schlüssel (mind. 32 Zeichen)

3. Klicken Sie auf **Deploy**.

---

## 7. Produktions-Domain konfigurieren

Da moderne Mobil-Browser (`getUserMedia`) den Kamerazugriff ausschließlich über eine sichere HTTPS-Verbindung gestatten:
* Vercel stellt automatisch für alle Domains und Vercel-Subdomains (`*.vercel.app`) kostenlose SSL/TLS-Zertifikate bereit.
* Fügen Sie in den Vercel-Projekteinstellungen unter **Domains** Ihre eigene Domain hinzu (z. B. `app.ihredomain.de`).
* Stellen Sie sicher, dass Aufrufe immer über **HTTPS** erfolgen, da Chrome, Safari und Firefox auf Smartphones bei unverschlüsseltem HTTP den Zugriff auf Kamera und Mikrofon sperren.

---

## 8. WebRTC Signaling-Architektur

### Serverless-kompatibles Signaling auf Vercel
Klassische WebSocket-Server (z. B. `ws` oder `socket.io`) benötigen einen permanent laufenden Hintergrundprozess, den serverlose Umgebungen (wie Vercel Lambdas) nicht bereitstellen können.

Diese Anwendung löst dies über eine integrierte **HTTP-Signaling-Pipeline** (`/api/signaling`):
1. Das Smartphone (Client) sendet sein SDP Offer und ICE-Kandidaten per POST an `/api/signaling`.
2. Das Admin-Dashboard ruft offene Signale für die jeweilige Sitzungs-ID ab und sendet das SDP Answer zurück.
3. Die WebRTC PeerConnection etabliert sich direkt Peer-to-Peer zwischen dem Smartphone und dem Browser des Administrators.
4. Dieser Ansatz funktioniert **ohne externe Drittanbieter-Dienste** direkt auf Vercel.

*(Optional für VPS/Docker-Deployments)*: Eine optionale WebSocket-Signaling-Datei `signaling-server.js` ist enthalten und kann mit `npm run signaling` gestartet werden.

---

## 9. Zugriff auf das Admin-Dashboard

1. Navigieren Sie zu `/admin` auf Ihrer Domain (z. B. `https://ihredomain.de/admin` oder `http://localhost:3000/admin`).
2. Melden Sie sich mit dem in `ADMIN_PASSWORD` konfigurierten Passwort an (Standard im Test: `AdminSecure2025!`).
3. Nach erfolgreicher Anmeldung sehen Sie die Liste aller **aktiven Sitzungen**:
   * Generierte Sitzungs-ID
   * Startzeitpunkt
   * Datenschutzkonform maskierte Telefonnummer (`+49 151 **** 5678`)
   * Verbindungsstatus (*„Live“*, *„Verbunden“*, *„Verbindung wird hergestellt...“*)
4. Klicken Sie auf **Stream öffnen**, um die Live-Kameraübertragung des Smartphones in Echtzeit zu betrachten.
5. Das Schließen des Tabs durch den Benutzer oder das Klicken auf *„Kamerafreigabe beenden“* entfernt die Sitzung automatisch in Echtzeit aus dem Admin-Dashboard.

---

## Sicherheitsrichtlinien

* **Kein verdeckter Zugriff**: Die Kamera kann niemals heimlich aktiviert werden. Die Aktivierung erfolgt ausschließlich nach explizitem Klick auf *„Kamera freigeben“* und Bestätigung des nativen Browser-Dialogs.
* **Permanenter Status**: Während der Übertragung wird dem Nutzer prominent signalisiert, dass die Kamera aktiv ist (*„Kamera aktiv“* und *„Ihre Kamera wird derzeit live übertragen.“*).
* **Datenschutz**: Telefonnummern werden im Admin-Dashboard niemals im Klartext angezeigt, sondern maskiert. Es werden keine Videoaufnahmen auf dem Server gespeichert (reines Live-Streaming).
* **Sichere Authentifizierung**: Alle administrativen Endpunkte verlangen ein serverseitig signiertes JWT in einem `httpOnly`, `secure`, `sameSite`-Cookie.
* **Rate Limiting**: Der SMS-Endpunkt ist durch einen IP- und Rufnummern-basierten Rate-Limiter geschützt, um SMS-Missbrauch und Toll Fraud zu unterbinden.
