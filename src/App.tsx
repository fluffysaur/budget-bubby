import { Wallet, Heart, PiggyBank, ArrowRightLeft } from 'lucide-react';

export function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-6 text-slate-800">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Wallet className="w-8 h-8" />
          </div>
          <Heart className="w-5 h-5 text-rose-500 fill-rose-500 animate-pulse" />
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <PiggyBank className="w-8 h-8" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">
          Budget Buddy
        </h1>
        <p className="text-sm text-center text-slate-500 mb-6">
          Couple &amp; Personal Finance for Yi Jia &amp; Rachel
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 text-sm">
            <span className="text-slate-600 font-medium">Currency</span>
            <span className="font-semibold text-emerald-600">SGD (S$)</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 text-sm">
            <span className="text-slate-600 font-medium">Default Split</span>
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
              <span>50 / 50</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 text-sm">
            <span className="text-slate-600 font-medium">CPF Deduction</span>
            <span className="font-semibold text-slate-700">20% Gross</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
