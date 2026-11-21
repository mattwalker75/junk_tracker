/**
 * True inside the iPhone / Android app (APP_PORTS/), where the log is kept on the phone and there is no
 * server: Settings then hides what only a server has (Users and sign-in, Network access, the files).
 * The phone build sets VITE_CC_PHONE; the web app's own build never does.
 */
export const PHONE_APP: boolean = import.meta.env.VITE_CC_PHONE === "1";
