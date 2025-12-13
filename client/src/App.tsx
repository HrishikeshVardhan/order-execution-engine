import { useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { 
  Activity, 
  CheckCircle2, 
  Loader2, 
  Search, 
  ArrowRightLeft, 
  Send,
  Layers,
  Zap,
  Hammer, // New Icon for "Building"
  FileCode
} from 'lucide-react';

// --- Types ---
interface Order {
  id: string;
  amount: number;
  side: string;
  // Added 'BUILDING' to the allowed statuses
  status: 'PENDING' | 'ROUTING' | 'BUILDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED';
  dex?: string;
  price?: number;
  txHash?: string;
  logs: string[];
  createdAt: number;
}

// --- Status Pipeline Configuration ---
const STEPS = [
  { id: 'PENDING', label: 'Queued', icon: Layers },
  { id: 'ROUTING', label: 'Routing', icon: Search },
  { id: 'BUILDING', label: 'Building', icon: Hammer }, // New Visual Step
  { id: 'SUBMITTED', label: 'Submitted', icon: Send },
  { id: 'CONFIRMED', label: 'Settled', icon: CheckCircle2 },
];

function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [amount, setAmount] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const activeConnections = useRef<Set<string>>(new Set());

  // --- Metrics Calculation ---
  const metrics = useMemo(() => {
    return {
      queued: orders.filter(o => o.status === 'PENDING').length,
      // Include BUILDING in the processing count
      processing: orders.filter(o => ['ROUTING', 'BUILDING', 'SUBMITTED'].includes(o.status)).length,
      completed: orders.filter(o => o.status === 'CONFIRMED').length,
    };
  }, [orders]);

  // --- Submit Single Order ---
  const executeOrder = async () => {
    setIsSubmitting(true);
    await submitSingleOrder();
    setIsSubmitting(false);
  };

  // --- Submit Batch ---
  const executeBatch = async () => {
    setIsSubmitting(true);
    const promises = Array(5).fill(0).map(() => submitSingleOrder());
    await Promise.all(promises);
    setIsSubmitting(false);
  };

  const submitSingleOrder = async () => {
    try {
      const res = await axios.post('http://localhost:3000/api/orders', {
        token: 'SOL',
        amount: Number(amount),
        side: 'buy'
      });
      const { orderId } = res.data;
      createLocalOrder(orderId);
      connectWebSocket(orderId);
    } catch (err) {
      console.error(err);
    }
  };

  const createLocalOrder = (orderId: string) => {
    const newOrder: Order = {
      id: orderId,
      amount: Number(amount),
      side: 'buy',
      status: 'PENDING',
      logs: [`[${new Date().toLocaleTimeString()}] Order queued in BullMQ`],
      createdAt: Date.now()
    };
    setOrders(prev => [newOrder, ...prev]);
  };

  const connectWebSocket = (orderId: string) => {
    if (activeConnections.current.has(orderId)) return;
    activeConnections.current.add(orderId);

    const ws = new WebSocket(`ws://localhost:3000/ws/orders/${orderId}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setOrders(prev => prev.map(o => {
        if (o.id !== orderId) return o;
        
        // --- Updated Log Logic for all 6 Steps ---
        let logMsg = `Status: ${data.status}`;
        if (data.status === 'ROUTING') logMsg = 'Worker picked up job. Scanning DEXs...';
        if (data.status === 'BUILDING') logMsg = 'Constructing Solana Transaction...'; // New Log
        if (data.status === 'SUBMITTED') logMsg = `Route selected: ${data.dex} @ $${data.price}. Tx Sent.`;
        if (data.status === 'CONFIRMED') logMsg = `Transaction confirmed on Solana`;
        if (data.status === 'FAILED') logMsg = `❌ Failed: ${data.error}`;

        return {
          ...o,
          status: data.status,
          dex: data.dex || o.dex,
          price: data.price || o.price,
          txHash: data.txHash || o.txHash,
          logs: [...o.logs, `[${new Date().toLocaleTimeString()}] ${logMsg}`]
        };
      }));

      if (['CONFIRMED', 'FAILED'].includes(data.status)) {
        activeConnections.current.delete(orderId);
        ws.close();
      }
    };
  };

  // --- Updated Logic to handle 5 Steps ---
  const getStepState = (currentStatus: string, stepId: string) => {
    const statusOrder = ['PENDING', 'ROUTING', 'BUILDING', 'SUBMITTED', 'CONFIRMED'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const stepIndex = statusOrder.indexOf(stepId);
    
    if (currentStatus === 'FAILED') return 'error';
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'inactive';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* --- LEFT COLUMN: CONTROLS --- */}
        <div className="lg:col-span-1 space-y-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Activity className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold">FlashEngine</h1>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
               <div className="text-xs text-slate-500 font-bold mb-1">QUEUE DEPTH</div>
               <div className="text-2xl font-mono text-yellow-400">{metrics.queued}</div>
             </div>
             <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
               <div className="text-xs text-slate-500 font-bold mb-1">PROCESSING</div>
               <div className="text-2xl font-mono text-blue-400">{metrics.processing}</div>
             </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <label className="text-xs font-bold text-slate-500 block mb-3">AMOUNT (SOL)</label>
            <input 
              type="number" 
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 mb-4 font-mono text-white"
            />
            
            <div className="space-y-3">
              <button 
                onClick={executeOrder}
                disabled={isSubmitting}
                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
              >
                {isSubmitting ? <Loader2 className="animate-spin w-4 h-4"/> : <ArrowRightLeft className="w-4 h-4"/>}
                Single Trade
              </button>
              
              <button 
                onClick={executeBatch}
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20 transition-all"
              >
                <Zap className="w-4 h-4 fill-white" />
                Blast 5 Orders (Batch)
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-4 text-center">
              Click 'Blast' to visualize queue concurrency.
            </p>
          </div>
        </div>

        {/* --- RIGHT COLUMN: FEED --- */}
        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Live Execution Pipeline</h2>
          
          {orders.length === 0 && (
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-800 rounded-xl text-slate-600">
              System Idle. Waiting for orders...
            </div>
          )}

          {orders.map(order => (
            <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg animate-in slide-in-from-left-4 fade-in duration-300">
              <div className="p-5">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-slate-500">ID: {order.id.split('-')[0]}...</span>
                      {order.dex && (
                         <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded border border-blue-500/20 font-bold uppercase">
                           {order.dex}
                         </span>
                       )}
                    </div>
                    <div className="text-lg font-bold text-slate-200">
                      Buy {order.amount} SOL 
                      {order.price && <span className="text-slate-400 font-normal"> @ ${order.price}</span>}
                    </div>
                  </div>
                  
                  <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    order.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                    order.status === 'CONFIRMED' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                    'bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse'
                  }`}>
                    {order.status}
                  </div>
                </div>

                {/* --- 5-STEP PROGRESS BAR --- */}
                <div className="relative flex justify-between items-center mb-4">
                   <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-800 -z-0"></div>
                   {STEPS.map((step, idx) => {
                     const state = getStepState(order.status, step.id);
                     return (
                       <div key={step.id} className="relative z-10 flex flex-col items-center bg-slate-900 px-2">
                         <div className={`
                           w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300
                           ${state === 'completed' ? 'bg-green-500 border-green-500 text-slate-900' : 
                             state === 'active' ? 'bg-blue-900 border-blue-500 text-blue-400 scale-110 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 
                             'bg-slate-800 border-slate-700 text-slate-600'}
                         `}>
                           <step.icon size={14} />
                         </div>
                         {/* Optional Label for Steps */}
                         {/* <span className="text-[10px] mt-1 text-slate-600 uppercase">{step.label}</span> */}
                       </div>
                     );
                   })}
                </div>

                <div className="bg-black/20 rounded p-2 text-xs font-mono text-slate-400 border border-slate-800/50 flex items-center gap-2">
                  <span className="text-slate-600">➜</span>
                  {order.logs[order.logs.length - 1]}
                </div>

              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;