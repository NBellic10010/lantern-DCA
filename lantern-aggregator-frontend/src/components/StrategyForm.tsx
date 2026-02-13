import { useState } from 'react';
import { Button, Input, Select, SelectItem, Card, CardBody, CardHeader, addToast } from "@heroui/react";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/solid";

interface Step {
  triggerType: 'time' | 'price_below' | 'price_above';
  triggerValue: string;
  percent: string;
  slippage: string;
}

export default function StrategyForm() {
  const [payWith, setPayWith] = useState("USDC");
  const [amount, setAmount] = useState("");
  const [steps, setSteps] = useState<Step[]>([
    { triggerType: 'time', triggerValue: '1', percent: '100', slippage: '0.1' }
  ]);

  const addStep = () => {
    setSteps([...steps, { triggerType: 'time', triggerValue: '1', percent: '10', slippage: '0.1' }]);
  };

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index);
    setSteps(newSteps);
  };

  const handleSubmit = async () => {
    // TODO: Integrate with Wallet Adapter
    addToast({
      title: "Strategy Created",
      description: `Investing ${amount} ${payWith} with ${steps.length} steps.`,
      color: "success"
    });
    console.log("Creating Strategy:", { payWith, amount, steps });
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader className="flex-col items-start">
            <h2 className="text-xl font-bold">Create Grid Strategy</h2>
            <p className="text-gray-500 text-sm">Configure your automated DCA plan</p>
        </CardHeader>
        <CardBody className="gap-6">
          
          {/* Asset Selection */}
          <div className="flex gap-4">
            <div className="flex-1">
              <Select 
                label="Pay With" 
                selectedKeys={[payWith]} 
                onChange={(e) => setPayWith(e.target.value)}
              >
                <SelectItem key="USDC">USDC</SelectItem>
                <SelectItem key="SUI">SUI</SelectItem>
                <SelectItem key="WBTC">wBTC</SelectItem>
              </Select>
            </div>
            <div className="flex-1">
              <Input 
                label="Total Amount" 
                type="number" 
                placeholder="1000" 
                value={amount}
                onValueChange={setAmount}
              />
            </div>
          </div>

          {/* Strategy Steps */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold">Strategy Steps</h3>
                <Button size="sm" color="primary" variant="flat" startContent={<PlusIcon className="w-4 h-4" />} onClick={addStep}>
                    Add Step
                </Button>
            </div>

            {steps.map((step, index) => (
              <Card key={index} className="bg-gray-50 border border-gray-200">
                <CardBody className="flex-row gap-4 items-end">
                    <div className="flex-1">
                        <Select 
                            label="Trigger Type" 
                            selectedKeys={[step.triggerType]}
                            onChange={(e) => {
                                const newSteps = [...steps];
                                newSteps[index].triggerType = e.target.value as any;
                                setSteps(newSteps);
                            }}
                        >
                            <SelectItem key="time">Time Interval</SelectItem>
                            <SelectItem key="price_below">Price Drop (Buy Dip)</SelectItem>
                            <SelectItem key="price_above">Price Rise (Take Profit)</SelectItem>
                        </Select>
                    </div>

                    <div className="flex-1">
                        <Input 
                            label={step.triggerType === 'time' ? "Interval (Days)" : "Target Price (SUI)"} 
                            type="number" 
                            value={step.triggerValue}
                            onValueChange={(val) => {
                                const newSteps = [...steps];
                                newSteps[index].triggerValue = val;
                                setSteps(newSteps);
                            }}
                        />
                    </div>

                    <div className="flex-1">
                        <Input 
                            label="Invest %" 
                            type="number" 
                            value={step.percent}
                            onValueChange={(val) => {
                                const newSteps = [...steps];
                                newSteps[index].percent = val;
                                setSteps(newSteps);
                            }}
                        />
                    </div>

                    <Button isIconOnly color="danger" variant="flat" onClick={() => removeStep(index)}>
                        <TrashIcon className="w-5 h-5" />
                    </Button>
                </CardBody>
              </Card>
            ))}
          </div>

          <Button color="primary" size="lg" className="w-full mt-4" onClick={handleSubmit}>
            Start Strategy
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

