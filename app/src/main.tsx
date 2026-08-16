// First import on purpose: installs the native app's FCM-token handler
// before anything else runs, so an auto-delivered token is never missed.
import "@/lib/nativeApp"
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import { TRPCProvider } from "@/providers/trpc"
import { ThemeProvider } from "@/contexts/ThemeContext"
import { LanguageProvider } from "@/contexts/LanguageContext"
import { AdCampaignsProvider } from "@/contexts/AdCampaignsContext"
import { SubscriptionPlansProvider } from "@/contexts/SubscriptionPlansContext"
import { HomeContentProvider } from "@/contexts/HomeContentContext"
import { NotificationsProvider } from "@/contexts/NotificationsContext"
import { OffersProvider } from "@/contexts/OffersContext"
import { FareConfigProvider } from "@/contexts/FareConfigContext"
import { DriverDocumentsProvider } from "@/contexts/DriverDocumentsContext"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <LanguageProvider>
            <TRPCProvider>
              <AdCampaignsProvider>
                <SubscriptionPlansProvider>
                  <HomeContentProvider>
                    <OffersProvider>
                      <FareConfigProvider>
                        <DriverDocumentsProvider>
                          <NotificationsProvider>
                            <App />
                          </NotificationsProvider>
                        </DriverDocumentsProvider>
                      </FareConfigProvider>
                    </OffersProvider>
                  </HomeContentProvider>
                </SubscriptionPlansProvider>
              </AdCampaignsProvider>
            </TRPCProvider>
          </LanguageProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
