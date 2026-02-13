import React, { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  addToast,
} from '@heroui/react';
import { useWallet } from '../contexts/WalletContext';

// 资产配置
const ASSETS = [
  { key: 'USDC', name: 'USDC', address: '0x5f759...::usdc::USDC', decimals: 6, icon: '💵' },
  { key: 'SUI', name: 'SUI', address: '0x2::sui::SUI', decimals: 9, icon: '🔷' },
  { key: 'CETUS', name: 'CETUS', address: '0xceb3307f36d1a805c352b3703e17d2381682e1d96e0a85b3c5a39424da452a69::cetus::CETUS', decimals: 9, icon: '🐬' },
];

// Step 数据类型
interface Step {
  triggerType: 'time' | 'price';
  triggerValue: string;
  inputAmount: string;
  slippage: string;
}

// Props
interface CreatePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePlanModal({ isOpen, onClose }: CreatePlanModalProps) {
  const { connected, address } = useWallet();

  // 表单状态
  const [payWith, setPayWith] = useState(ASSETS[0]);
  const [receiveAsset, setReceiveAsset] = useState(ASSETS[1]);
  const [totalAmount, setTotalAmount] = useState('');
  const [steps, setSteps] = useState<Step[]>([
    { triggerType: 'time', triggerValue: '7', inputAmount: '', slippage: '100' },
  ]);
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // 添加 Step
  const addStep = () => {
    setSteps([...steps, { triggerType: 'time', triggerValue: '7', inputAmount: '', slippage: '100' }]);
    setIsAddingStep(true);
    setTimeout(() => setIsAddingStep(false), 100);
  };

  // 移除 Step
  const removeStep = (index: number) => {
    if (steps.length > 1) {
      setSteps(steps.filter((_, i) => i !== index));
    }
  };

  // 更新 Step
  const updateStep = (index: number, field: keyof Step, value: string) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  // 计算总投入
  const totalInvested = steps.reduce((sum, step) => {
    const amount = parseFloat(step.inputAmount) || 0;
    return sum + amount;
  }, 0);

  // 检查是否可以提交
  const canSubmit = connected && totalAmount && parseFloat(totalAmount) > 0 && totalInvested === parseFloat(totalAmount);

  // 提交表单
  const handleSubmit = async () => {
    if (!canSubmit) {
      addToast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        color: 'danger',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: 实际提交到智能合约
      await new Promise(resolve => setTimeout(resolve, 2000));

      addToast({
        title: 'Plan Created!',
        description: `Your DCA plan with ${steps.length} steps has been created`,
        color: 'success',
      });

      onClose();
      resetForm();
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to create plan',
        color: 'danger',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 重置表单
  const resetForm = () => {
    setPayWith(ASSETS[0]);
    setReceiveAsset(ASSETS[1]);
    setTotalAmount('');
    setSteps([{ triggerType: 'time', triggerValue: '7', inputAmount: '', slippage: '100' }]);
    setShowConfirm(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      classNames={{
        base: 'max-h-[90vh]',
        wrapper: 'bg-black/50 backdrop-blur-sm',
      }}
    >
      <ModalContent>
        {!showConfirm ? (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h2 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                Create DCA Plan
              </h2>
              <p className="text-sm text-gray-500 font-normal">
                Set up your automated dollar-cost averaging strategy
              </p>
            </ModalHeader>

            <ModalBody>
              <div className="space-y-6">
                {/* Asset Selection - DEX Style */}
                <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200">
                  <CardBody className="gap-4">
                    {/* Pay With */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Pay With
                      </label>
                      <div className="flex gap-2">
                        {ASSETS.map((asset) => (
                          <Button
                            key={asset.key}
                            variant={payWith.key === asset.key ? 'solid' : 'flat'}
                            color={payWith.key === asset.key ? 'primary' : 'default'}
                            onClick={() => setPayWith(asset)}
                            className={`flex-1 ${
                              payWith.key === asset.key
                                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                                : ''
                            }`}
                            startContent={<span className="text-lg">{asset.icon}</span>}
                          >
                            {asset.name}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Total Amount */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Total Investment Amount
                      </label>
                      <div className="relative">
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={totalAmount}
                          onValueChange={setTotalAmount}
                          classNames={{
                            inputWrapper: 'bg-white border-gray-200',
                          }}
                          endContent={
                            <span className="text-gray-400 text-sm px-2">
                              {payWith.name}
                            </span>
                          }
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                          <Button
                            size="sm"
                            variant="flat"
                            color="primary"
                            onClick={() => setTotalAmount('1000')}
                          >
                            MAX
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Receive Asset */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Receive Asset
                      </label>
                      <div className="flex gap-2">
                        {ASSETS.filter(a => a.key !== payWith.key).map((asset) => (
                          <Button
                            key={asset.key}
                            variant={receiveAsset.key === asset.key ? 'solid' : 'flat'}
                            color={receiveAsset.key === asset.key ? 'secondary' : 'default'}
                            onClick={() => setReceiveAsset(asset)}
                            className={`flex-1 ${
                              receiveAsset.key === asset.key
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                                : ''
                            }`}
                            startContent={<span className="text-lg">{asset.icon}</span>}
                          >
                            {asset.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardBody>
                </Card>

                <Divider />

                {/* Steps Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-800">Strategy Steps</h3>
                      <p className="text-xs text-gray-500">
                        Configure when and how to execute each purchase
                      </p>
                    </div>
                    <Button
                      size="sm"
                      color="primary"
                      variant="flat"
                      onClick={addStep}
                      startContent={
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      }
                    >
                      Add Step
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {steps.map((step, index) => (
                      <Card
                        key={index}
                        className={`bg-gray-50 border border-gray-200 ${
                          isAddingStep && index === steps.length - 1 ? 'animate-pulse' : ''
                        }`}
                      >
                        <CardBody className="gap-3">
                          {/* Step Header */}
                          <div className="flex items-center justify-between">
                            <Chip size="sm" color="primary" variant="flat">
                              Step {index + 1}
                            </Chip>
                            {steps.length > 1 && (
                              <Button
                                isIconOnly
                                size="sm"
                                variant="flat"
                                color="danger"
                                onClick={() => removeStep(index)}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </Button>
                            )}
                          </div>

                          {/* Step Content */}
                          <div className="grid grid-cols-2 gap-3">
                            {/* Trigger Type */}
                            <Select
                              label="Trigger Type"
                              size="sm"
                              selectedKeys={[step.triggerType]}
                              onChange={(e) => updateStep(index, 'triggerType', e.target.value as 'time' | 'price')}
                            >
                              <SelectItem key="time">Time Interval</SelectItem>
                              <SelectItem key="price">Price Trigger</SelectItem>
                            </Select>

                            {/* Trigger Value */}
                            <Input
                              label={step.triggerType === 'time' ? 'Interval (Days)' : 'Target Price (SUI)'}
                              type="number"
                              size="sm"
                              placeholder={step.triggerType === 'time' ? '7' : '3.50'}
                              value={step.triggerValue}
                              onValueChange={(val) => updateStep(index, 'triggerValue', val)}
                            />

                            {/* Input Amount */}
                            <Input
                              label={`Amount (${payWith.name})`}
                              type="number"
                              size="sm"
                              placeholder="0.00"
                              value={step.inputAmount}
                              onValueChange={(val) => updateStep(index, 'inputAmount', val)}
                            />

                            {/* Slippage */}
                            <Input
                              label="Slippage Tolerance (%)"
                              type="number"
                              size="sm"
                              placeholder="1.0"
                              value={step.slippage}
                              onValueChange={(val) => updateStep(index, 'slippage', val)}
                              disabled={step.triggerType === 'time'}
                            />
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <Card className="bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-100">
                  <CardBody>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total Investment</p>
                        <p className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                          {totalAmount || '0.00'} {payWith.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Number of Steps</p>
                        <p className="text-2xl font-bold text-gray-800">{steps.length}</p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </ModalBody>

            <ModalFooter>
              <Button variant="flat" onPress={onClose}>
                Cancel
              </Button>
              <Button
                color="primary"
                onClick={() => setShowConfirm(true)}
                isDisabled={!canSubmit}
                className="bg-gradient-to-r from-blue-500 to-blue-600 text-white"
              >
                Review Plan
              </Button>
            </ModalFooter>
          </>
        ) : (
          <>
            <ModalHeader>
              <h2 className="text-xl font-bold">Confirm Your Plan</h2>
            </ModalHeader>

            <ModalBody>
              <Card className="bg-white">
                <CardBody className="gap-4">
                  {/* Summary Header */}
                  <div className="flex items-center justify-center gap-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{payWith.icon}</span>
                      <span className="text-xl font-bold">{payWith.name}</span>
                    </div>
                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold">{receiveAsset.name}</span>
                      <span className="text-2xl">{receiveAsset.icon}</span>
                    </div>
                  </div>

                  <Divider />

                  {/* Investment Details */}
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Investment</span>
                      <span className="font-semibold">{totalAmount} {payWith.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Number of Steps</span>
                      <span className="font-semibold">{steps.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Avg per Step</span>
                      <span className="font-semibold">
                        {(parseFloat(totalAmount) / steps.length).toFixed(2)} {payWith.name}
                      </span>
                    </div>
                  </div>

                  <Divider />

                  {/* Steps Summary */}
                  <div>
                    <h4 className="font-medium mb-2">Strategy Breakdown</h4>
                    <div className="space-y-2">
                      {steps.map((step, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <Chip size="sm" variant="flat">
                              {index + 1}
                            </Chip>
                            <span className="text-sm">
                              {step.triggerType === 'time'
                                ? `Every ${step.triggerValue} days`
                                : `Price: ${step.triggerValue} SUI`
                              }
                            </span>
                          </div>
                          <span className="font-medium text-sm">
                            {step.inputAmount} {payWith.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardBody>
              </Card>
            </ModalBody>

            <ModalFooter>
              <Button variant="flat" onClick={() => setShowConfirm(false)}>
                Back
              </Button>
              <Button
                color="primary"
                isLoading={isSubmitting}
                onClick={handleSubmit}
                className="bg-gradient-to-r from-green-500 to-emerald-500 text-white"
              >
                {isSubmitting ? 'Creating...' : 'Confirm & Create Plan'}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

