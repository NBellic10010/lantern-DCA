import React, { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, Button, Chip, Progress, Spinner, Avatar, Badge } from '@heroui/react';
import { addToast } from '@heroui/react';
import { useWallet } from '../contexts/WalletContext';

// API 配置
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// 币种图标映射
const COIN_ICONS: Record<string, string> = {
  'SUI': '🔷',
  'USDC': '💵',
  'CETUS': '🐬',
};

// Plan 数据类型
interface Plan {
  planId: string;
  owner: string;
  inputType: string;
  outputType: string;
  inputAmount: number;
  remainingAmount: number;
  currentStepIndex: number;
  steps: PlanStep[];
  status: 'active' | 'completed' | 'failed' | 'paused';
  createdAt: string;
  updatedAt: string;
}

interface PlanStep {
  index: number;
  triggerType: number; // 0 = Time, 1 = Price
  triggerVal: number;
  inputAmount: number;
  slippageTolerance: number;
}

// 提取币种名称
function getCoinName(coinType: string): string {
  if (coinType.includes('sui')) return 'SUI';
  if (coinType.includes('usdc')) return 'USDC';
  if (coinType.includes('cetus')) return 'CETUS';
  return coinType.split('::').pop() || 'COIN';
}

// 触发器类型名称
function getTriggerName(triggerType: number): string {
  switch (triggerType) {
    case 0: return 'Time';
    case 1: return 'Price';
    default: return 'Unknown';
  }
}

// 格式化日期
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PlanList() {
  const { connected, address } = useWallet();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  // 获取用户计划列表
  const fetchPlans = async () => {
    if (!connected || !address) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/plans?user=${address}`);
      if (!response.ok) throw new Error('Failed to fetch plans');

      const data = await response.json();
      setPlans(data);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [connected, address]);

  if (!connected) {
    return (
      <Card className="overflow-hidden">
        <CardBody className="flex flex-col items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Connect Your Wallet</h3>
            <p className="text-gray-500 text-sm max-w-xs mx-auto">
              Connect your wallet to view and manage your DCA plans
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardBody className="flex items-center justify-center py-12">
          <Spinner size="lg" color="primary" label="Loading your plans..." />
        </CardBody>
      </Card>
    );
  }

  if (plans.length === 0) {
    return (
      <Card className="overflow-hidden">
        <CardBody className="flex flex-col items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Active Plans</h3>
            <p className="text-gray-500 text-sm max-w-xs mx-auto mb-4">
              You don't have any DCA plans yet. Create your first plan to get started!
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {plans.map((plan, index) => {
        const inputCoin = getCoinName(plan.inputType);
        const outputCoin = getCoinName(plan.outputType);
        const totalSteps = plan.steps.length;
        const completedSteps = plan.currentStepIndex;
        const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

        return (
          <Card
            key={plan.planId}
            className={`overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg ${
              selectedPlan?.planId === plan.planId ? 'ring-2 ring-primary-500' : ''
            }`}
            onClick={() => setSelectedPlan(selectedPlan?.planId === plan.planId ? null : plan)}
          >
            <CardBody className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {/* Pair Icons */}
                  <div className="flex items-center -space-x-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold z-10">
                      {inputCoin.slice(0, 2)}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white text-sm font-bold">
                      {outputCoin.slice(0, 2)}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800">{inputCoin} → {outputCoin}</h4>
                    <p className="text-xs text-gray-500">
                      Created {formatDate(plan.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Chip
                    size="sm"
                    variant="flat"
                    color={
                      plan.status === 'active' ? 'success' :
                      plan.status === 'completed' ? 'default' :
                      plan.status === 'failed' ? 'danger' : 'warning'
                    }
                  >
                    {plan.status}
                  </Chip>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Progress</span>
                  <span className="font-medium text-gray-700">
                    {completedSteps} / {totalSteps} steps
                  </span>
                </div>
                <Progress
                  value={progressPercent}
                  size="sm"
                  color="primary"
                  classNames={{
                    base: 'bg-gray-100',
                    track: 'bg-gray-200',
                    indicator: 'bg-gradient-to-r from-primary-500 to-secondary-500',
                  }}
                />
              </div>

              {/* Details (展开时显示) */}
              {selectedPlan?.planId === plan.planId && (
                <div className="mt-4 pt-4 border-t border-gray-100 animate-in slide-in-from-top-2 duration-200">
                  {/* Steps Timeline */}
                  <div className="space-y-3">
                    {plan.steps.map((step, stepIndex) => (
                      <div
                        key={step.index}
                        className={`flex items-center gap-3 p-3 rounded-lg ${
                          stepIndex < completedSteps ? 'bg-green-50' :
                          stepIndex === completedSteps ? 'bg-primary-50' : 'bg-gray-50'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          stepIndex < completedSteps ? 'bg-green-500 text-white' :
                          stepIndex === completedSteps ? 'bg-primary-500 text-white' : 'bg-gray-300 text-gray-500'
                        }`}>
                          {stepIndex < completedSteps ? '✓' : stepIndex + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-700">
                            Step {step.index + 1}: {getTriggerName(step.triggerType)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {step.triggerType === 0
                              ? `Every ${step.triggerVal} days`
                              : `Target: ${step.triggerVal}`
                            }
                            {' • '}
                            {(step.inputAmount / Math.pow(10, 6)).toFixed(2)} {inputCoin}
                            {' • '}
                            Slippage: {step.slippageTolerance}bps
                          </p>
                        </div>
                        {stepIndex < completedSteps && (
                          <Chip size="sm" color="success" variant="flat">Completed</Chip>
                        )}
                        {stepIndex === completedSteps && (
                          <Chip size="sm" color="primary" variant="flat">Next</Chip>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                    <Button size="sm" variant="flat" color="primary">
                      View Details
                    </Button>
                    {plan.status === 'active' && (
                      <Button size="sm" variant="flat" color="warning">
                        Pause
                      </Button>
                    )}
                    <Button size="sm" variant="flat" color="danger">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Summary Footer */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                <div className="flex gap-4 text-sm">
                  <span className="text-gray-500">
                    Total: <span className="font-medium text-gray-700">{plan.inputAmount.toFixed(2)} {inputCoin}</span>
                  </span>
                  <span className="text-gray-500">
                    Remaining: <span className="font-medium text-gray-700">{plan.remainingAmount.toFixed(2)} {inputCoin}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <span>APR ~</span>
                  <span className="font-medium text-primary-500">12.5%</span>
                </div>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

