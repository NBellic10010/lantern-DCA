import { Button, Breadcrumbs, BreadcrumbItem } from '@heroui/react';
import { WalletButton } from '../contexts/WalletContext';

interface NavbarProps {
  onCreatePlan: () => void;
}

export function Navbar({ onCreatePlan }: NavbarProps) {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-gray-200/50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Breadcrumb */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                Lantern
              </span>
            </div>

            {/* Breadcrumb */}
            <Breadcrumbs classNames={{
              list: "gap-2",
              separator: "text-gray-400"
            }}>
              <BreadcrumbItem href="/" className="text-gray-600 font-medium">
                Dashboard
              </BreadcrumbItem>
              <BreadcrumbItem href="/markets" className="hover:text-primary-600 transition-colors">
                Markets
              </BreadcrumbItem>
            </Breadcrumbs>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {/* Create Plan Button - Blue gradient */}
            <Button
              color="primary"
              variant="solid"
              onClick={onCreatePlan}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium px-6 shadow-lg shadow-blue-500/25 transition-all duration-200 hover:scale-105 active:scale-95"
              startContent={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              Create Plan
            </Button>

            {/* Wallet Connection */}
            <WalletButton />
          </div>
        </div>
      </div>
    </nav>
  );
}

