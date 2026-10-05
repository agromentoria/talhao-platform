import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

// fontes embutidas no app (sem Google Fonts): funcionam offline, no app
// nativo e não enviam dados do usuário a terceiros (LGPD)
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/baloo-2/latin-600.css";
import "@fontsource/baloo-2/latin-700.css";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";

import App from "./app/App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { PageMetaProvider } from "./components/layout/PageMeta.jsx";
import { DialogProvider, ToastProvider } from "./components/ui";
import { registerServiceWorker } from "./lib/pwa";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PageMetaProvider>
          <ToastProvider>
            <DialogProvider>
              <App />
            </DialogProvider>
          </ToastProvider>
        </PageMetaProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

registerServiceWorker();
