import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { HomePage } from '@/pages/home'
import { PercentagePage } from '@/pages/percentage'
import { SplitGroupMealPage } from '@/pages/split-group-meal'
import { ServiceChargePage } from '@/pages/service-charge'
import { SplitTaxiPage } from '@/pages/split-taxi'
import { TipPage } from '@/pages/tip'
import { VatPage } from '@/pages/vat'
import { SplitGroupOrderPage } from '@/pages/split-group-order'
import { SplitMealPage } from '@/pages/split-meal'

/** The routes alone, so tests can mount them inside a MemoryRouter. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="split-meal" element={<SplitMealPage />} />
        <Route path="split-group-order" element={<SplitGroupOrderPage />} />
        <Route path="split-group-meal" element={<SplitGroupMealPage />} />
        <Route path="percentage" element={<PercentagePage />} />
        <Route path="split-taxi" element={<SplitTaxiPage />} />
        <Route path="vat" element={<VatPage />} />
        <Route path="service-charge" element={<ServiceChargePage />} />
        <Route path="tip" element={<TipPage />} />
        {/* Anything else — an old link, a typo — lands on the tool list. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function App() {
  // BASE_URL is "/" in dev and "/app-harn/" in the Pages build.
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
