import { useState } from 'react';
import { Card, CardBody, CardHeader, Tabs, Tab } from '@heroui/react';
import { WalletProvider } from './contexts/WalletContext';
import { Navbar } from './components/Navbar';
import { MarketOverview } from './components/MarketOverview';
import { PlanList } from './components/PlanList';
import { CreatePlanModal } from './components/CreatePlanModal';

function AppContent() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Navbar */}
      <Navbar onCreatePlan={() => setIsModalOpen(true)} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-primary-500 via-purple-500 to-secondary-500 rounded-2xl p-8 text-white shadow-xl shadow-purple-500/20">
            <div className="max-w-2xl">
              <h1 className="text-3xl md:text-4xl font-bold mb-4">
                Automated DCA & Grid Trading
              </h1>
              <p className="text-white/80 text-lg mb-6">
                Set up automated buying strategies on Sui. Dollar-cost average into positions
                or execute grid trades with smart order routing through Cetus CLMM.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                  <p className="text-2xl font-bold">$2.4M+</p>
                  <p className="text-white/70 text-sm">Volume Traded</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                  <p className="text-2xl font-bold">1,250+</p>
                  <p className="text-white/70 text-sm">Active Plans</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                  <p className="text-2xl font-bold">12.5%</p>
                  <p className="text-white/70 text-sm">Avg. APY</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Plans */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg border border-gray-100">
              <CardHeader className="pb-0">
                <Tabs
                  aria-label="Plan tabs"
                  classNames={{
                    tabList: "gap-6",
                    cursor: "bg-primary-500",
                    tab: "px-4 h-12",
                  }}
                >
                  <Tab
                    key="active"
                    title={
                      <div className="flex items-center gap-2">
                        <span>Active Plans</span>
                        <span className="bg-primary-100 text-primary-600 py-0.5 px-2 rounded-full text-xs">
                          3
                        </span>
                      </div>
                    }
                  />
                  <Tab
                    key="history"
                    title={
                      <div className="flex items-center gap-2">
                        <span>History</span>
                        <span className="bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                          12
                        </span>
                      </div>
                    }
                  />
                </Tabs>
              </CardHeader>
              <CardBody className="pt-4">
                <PlanList />
              </CardBody>
            </Card>
          </div>

          {/* Right Column - Market Info */}
          <div className="lg:col-span-1">
            <MarketOverview />
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-white/50 backdrop-blur-sm border border-gray-100">
            <CardBody className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2">Smart Order Routing</h3>
              <p className="text-gray-500 text-sm">
                Optimized execution through Cetus CLMM pools for the best rates
              </p>
            </CardBody>
          </Card>

          <Card className="bg-white/50 backdrop-blur-sm border border-gray-100">
            <CardBody className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2">Automated Execution</h3>
              <p className="text-gray-500 text-sm">
                Set triggers and let our keeper bots execute your strategy 24/7
              </p>
            </CardBody>
          </Card>

          <Card className="bg-white/50 backdrop-blur-sm border border-gray-100">
            <CardBody className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2">Secure & Transparent</h3>
              <p className="text-gray-500 text-sm">
                All transactions on-chain with verifiable smart contracts
              </p>
            </CardBody>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-gray-200 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="font-semibold text-gray-700">Lantern</span>
            </div>
            <p className="text-gray-500 text-sm">
              Powered by Cetus CLMM on Sui
            </p>
          </div>
        </div>
      </footer>

      {/* Create Plan Modal */}
      <CreatePlanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

function App() {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
}

export default App;
