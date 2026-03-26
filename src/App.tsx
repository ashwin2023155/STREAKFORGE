import React, { useState, useEffect } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  parseISO
} from 'date-fns';
import { ChevronLeft, ChevronRight, Star, LogIn, LogOut, Trophy, Dumbbell, Code, BookOpen, Sparkles } from 'lucide-react';
import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';
import { cn } from './lib/utils';
import { DailyLog, DSAData, GymData, LearningData } from './types';
import { getGeminiSuggestion } from './services/geminiService';
import { motion, AnimatePresence } from 'motion/react';

// --- Components ---

const Auth = ({ user, onLogin, onLogout }: { user: User | null, onLogin: () => void, onLogout: () => void }) => (
  <div className="flex items-center justify-between p-4 bg-white border-b border-gray-100 sticky top-0 z-50">
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white font-bold text-xl">S</div>
      <h1 className="text-xl font-bold tracking-tighter uppercase">STREAKFORGE</h1>
    </div>
    {user ? (
      <div className="flex items-center gap-4">
        <div className="hidden md:block text-right">
          <p className="text-sm font-medium">{user.displayName}</p>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>
        <button 
          onClick={onLogout}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          title="Logout"
        >
          <LogOut size={20} />
        </button>
      </div>
    ) : (
      <button 
        onClick={onLogin}
        className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-all font-medium text-sm"
      >
        <LogIn size={18} />
        Sign in with Google
      </button>
    )}
  </div>
);

const Calendar = ({ logs, selectedDate, onSelectDate }: { logs: DailyLog[], selectedDate: Date, onSelectDate: (date: Date) => void }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const getLogForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return logs.find(l => l.date === dateStr);
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-semibold tracking-tight">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-2">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            {day}
          </div>
        ))}
        {days.map(day => {
          const log = getLogForDate(day);
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={day.toString()}
              onClick={() => onSelectDate(day)}
              className={cn(
                "relative aspect-square flex flex-col items-center justify-center rounded-2xl transition-all duration-200",
                !isCurrentMonth && "opacity-20",
                isSelected ? "bg-black text-white scale-105 shadow-lg" : "hover:bg-gray-50",
                isToday && !isSelected && "border-2 border-black"
              )}
            >
              <span className="text-sm font-medium">{format(day, 'd')}</span>
              {log?.allCompleted && (
                <Star 
                  size={14} 
                  className={cn(
                    "absolute top-1 right-1 fill-yellow-400 text-yellow-400",
                    isSelected ? "text-white fill-white" : ""
                  )} 
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const TaskCard = ({ 
  icon: Icon, 
  title, 
  completed, 
  children,
  colorClass
}: { 
  icon: any, 
  title: string, 
  completed: boolean, 
  children: React.ReactNode,
  colorClass: string
}) => (
  <div className={cn(
    "p-6 rounded-3xl border transition-all duration-300",
    completed ? "bg-white border-green-100 shadow-sm" : "bg-gray-50 border-transparent"
  )}>
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-xl", colorClass)}>
          <Icon size={20} className="text-white" />
        </div>
        <h3 className="font-semibold text-lg">{title}</h3>
      </div>
      <div className={cn(
        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
        completed ? "bg-green-500 border-green-500" : "border-gray-300"
      )}>
        {completed && <Star size={12} className="text-white fill-white" />}
      </div>
    </div>
    {children}
  </div>
);

const RecentHistory = ({ logs }: { logs: DailyLog[] }) => {
  const sortedLogs = [...logs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter(l => l.date !== format(new Date(), 'yyyy-MM-dd'))
    .slice(0, 5);

  if (sortedLogs.length === 0) return null;

  return (
    <div className="mt-12 space-y-6">
      <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
        <Trophy size={20} className="text-yellow-500" />
        Recent Forge History
      </h3>
      <div className="space-y-4">
        {sortedLogs.map(log => (
          <div key={log.date} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-gray-400 mb-1">{format(parseISO(log.date), 'EEEE, do MMM')}</p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", log.dsa.completed ? "bg-blue-500" : "bg-gray-200")} />
                  <span className="text-xs font-medium">{log.dsa.topic || "No DSA"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", log.gym.completed ? "bg-orange-500" : "bg-gray-200")} />
                  <span className="text-xs font-medium">{log.gym.type === 'steps' ? `${log.gym.steps} steps` : (log.gym.progress || "Gym")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", log.learning.completed ? "bg-purple-500" : "bg-gray-200")} />
                  <span className="text-xs font-medium truncate max-w-[150px]">{log.learning.concept || "No Learning"}</span>
                </div>
              </div>
            </div>
            {log.allCompleted && (
              <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1 rounded-full">
                <Star size={14} className="fill-yellow-400 text-yellow-400" />
                <span className="text-xs font-bold text-yellow-700">FORGED</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Current Log State
  const [dsa, setDsa] = useState<DSAData>({ completed: false, topic: '', count: 0 });
  const [gym, setGym] = useState<GymData>({ completed: false, type: 'gym', steps: 0, progress: '' });
  const [learning, setLearning] = useState<LearningData>({ completed: false, concept: '', documentation: '' });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        // Test connection
        const testConnection = async () => {
          try {
            await getDocFromServer(doc(db, 'test', 'connection'));
          } catch (e) {}
        };
        testConnection();
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setLogs([]);
      return;
    }

    const q = query(collection(db, 'logs'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyLog));
      setLogs(fetchedLogs);
    }, (error) => {
      console.error("Firestore Error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const existingLog = logs.find(l => l.date === dateStr);

    if (existingLog) {
      setDsa(existingLog.dsa);
      setGym(existingLog.gym);
      setLearning(existingLog.learning);
    } else {
      setDsa({ completed: false, topic: '', count: 0 });
      setGym({ completed: false, type: 'gym', steps: 0, progress: '' });
      setLearning({ completed: false, concept: '', documentation: '' });
    }
  }, [selectedDate, logs]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
        console.error("Login Error:", error);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => auth.signOut();

  const saveLog = async () => {
    if (!user) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const logId = `${user.uid}_${dateStr}`;
    
    const allCompleted = dsa.completed && gym.completed && learning.completed;

    const logData: DailyLog = {
      userId: user.uid,
      date: dateStr,
      dsa,
      gym,
      learning,
      allCompleted
    };

    try {
      await setDoc(doc(db, 'logs', logId), logData);
    } catch (error) {
      console.error("Save Error:", error);
    }
  };

  const suggestDSATopic = async () => {
    setAiLoading(true);
    const prompt = "Suggest a DSA topic for today's practice for a student named Ashwin. Give a brief explanation and one common problem name. Keep it short.";
    const suggestion = await getGeminiSuggestion(prompt);
    setDsa(prev => ({ ...prev, topic: suggestion }));
    setAiLoading(false);
  };

  const summarizeLearning = async () => {
    if (!learning.documentation) return;
    setAiLoading(true);
    const prompt = `Summarize this learning concept documentation into a concise 2-sentence journal entry: ${learning.documentation}`;
    const summary = await getGeminiSuggestion(prompt);
    setLearning(prev => ({ ...prev, documentation: summary }));
    setAiLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-20">
      <Auth user={user} onLogin={handleLogin} onLogout={handleLogout} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {!user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 bg-black rounded-3xl flex items-center justify-center text-white mb-8 shadow-xl rotate-3">
              <Trophy size={48} />
            </div>
            <h2 className="text-4xl font-bold tracking-tight mb-4">Master Your Daily Triad</h2>
            <p className="text-gray-500 max-w-md mb-8 leading-relaxed">
              Track your DSA progress, gym gains, and daily learning. 
              Complete all three to earn a star on your calendar.
            </p>
            <button 
              onClick={handleLogin}
              className="px-8 py-4 bg-black text-white rounded-2xl hover:bg-gray-800 transition-all font-semibold text-lg shadow-lg hover:shadow-xl active:scale-95"
            >
              Get Started Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Calendar & Stats */}
            <div className="lg:col-span-5 space-y-8">
              <Calendar 
                logs={logs} 
                selectedDate={selectedDate} 
                onSelectDate={setSelectedDate} 
              />
              
              <div className="bg-black text-white rounded-3xl p-8 shadow-xl overflow-hidden relative">
                <div className="relative z-10">
                  <h3 className="text-lg font-medium opacity-70 mb-1">Total Stars Earned</h3>
                  <p className="text-6xl font-bold tracking-tighter mb-4">
                    {logs.filter(l => l.allCompleted).length}
                  </p>
                  <div className="flex gap-2">
                    {Array.from({ length: Math.min(5, logs.filter(l => l.allCompleted).length) }).map((_, i) => (
                      <Star key={i} size={20} className="fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
                <Trophy size={120} className="absolute -bottom-4 -right-4 opacity-10 rotate-12" />
              </div>
            </div>

            {/* Right Column: Daily Tasks */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-3xl font-bold tracking-tight">
                  {isSameDay(selectedDate, new Date()) ? "Today's Focus" : format(selectedDate, 'do MMMM')}
                </h2>
                <button 
                  onClick={saveLog}
                  className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-all font-medium text-sm shadow-md"
                >
                  Save Progress
                </button>
              </div>

              <AnimatePresence mode="wait">
                <motion.div 
                  key={selectedDate.toString()}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {/* DSA Task */}
                  <TaskCard 
                    icon={Code} 
                    title="DSA Questions" 
                    completed={dsa.completed}
                    colorClass="bg-blue-500"
                  >
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="Topic (e.g. Linked Lists)" 
                          value={dsa.topic}
                          onChange={(e) => setDsa({ ...dsa, topic: e.target.value })}
                          className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                        <button 
                          onClick={suggestDSATopic}
                          disabled={aiLoading}
                          className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-50"
                          title="Get AI Suggestion"
                        >
                          <Sparkles size={18} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-500">Questions:</span>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => setDsa({ ...dsa, count: Math.max(0, dsa.count - 1) })}
                              className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                            >
                              -
                            </button>
                            <span className="font-bold w-4 text-center">{dsa.count}</span>
                            <button 
                              onClick={() => setDsa({ ...dsa, count: dsa.count + 1, completed: dsa.count + 1 >= 1 })}
                              className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={dsa.completed}
                            onChange={(e) => setDsa({ ...dsa, completed: e.target.checked })}
                            className="w-5 h-5 rounded-lg border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium">Done</span>
                        </label>
                      </div>
                    </div>
                  </TaskCard>

                  {/* Gym Task */}
                  <TaskCard 
                    icon={Dumbbell} 
                    title="Physical Activity" 
                    completed={gym.completed}
                    colorClass="bg-orange-500"
                  >
                    <div className="space-y-4">
                      <div className="flex p-1 bg-gray-100 rounded-xl">
                        <button 
                          onClick={() => setGym({ ...gym, type: 'gym' })}
                          className={cn(
                            "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all",
                            gym.type === 'gym' ? "bg-white shadow-sm" : "text-gray-500"
                          )}
                        >
                          Gym Session
                        </button>
                        <button 
                          onClick={() => setGym({ ...gym, type: 'steps' })}
                          className={cn(
                            "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all",
                            gym.type === 'steps' ? "bg-white shadow-sm" : "text-gray-500"
                          )}
                        >
                          10k Steps
                        </button>
                      </div>
                      
                      {gym.type === 'steps' ? (
                        <div className="flex items-center gap-4">
                          <input 
                            type="number" 
                            placeholder="Steps count" 
                            value={gym.steps || ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setGym({ ...gym, steps: val, completed: val >= 10000 });
                            }}
                            className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                          />
                          <span className="text-xs text-gray-400 font-medium">/ 10,000</span>
                        </div>
                      ) : (
                        <textarea 
                          placeholder="What did you hit today? (e.g. Chest & Triceps)" 
                          value={gym.progress}
                          onChange={(e) => setGym({ ...gym, progress: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 h-20 resize-none"
                        />
                      )}

                      <div className="flex justify-end">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={gym.completed}
                            onChange={(e) => setGym({ ...gym, completed: e.target.checked })}
                            className="w-5 h-5 rounded-lg border-gray-300 text-orange-600 focus:ring-orange-500"
                          />
                          <span className="text-sm font-medium">Done</span>
                        </label>
                      </div>
                    </div>
                  </TaskCard>

                  {/* Learning Task */}
                  <TaskCard 
                    icon={BookOpen} 
                    title="Daily Concept" 
                    completed={learning.completed}
                    colorClass="bg-purple-500"
                  >
                    <div className="space-y-4">
                      <input 
                        type="text" 
                        placeholder="What did you learn?" 
                        value={learning.concept}
                        onChange={(e) => setLearning({ ...learning, concept: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      />
                      <div className="relative">
                        <textarea 
                          placeholder="Document your findings..." 
                          value={learning.documentation}
                          onChange={(e) => setLearning({ ...learning, documentation: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 h-32 resize-none"
                        />
                        <button 
                          onClick={summarizeLearning}
                          disabled={aiLoading || !learning.documentation}
                          className="absolute bottom-3 right-3 p-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-colors disabled:opacity-50"
                          title="Summarize with AI"
                        >
                          <Sparkles size={18} />
                        </button>
                      </div>
                      <div className="flex justify-end">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={learning.completed}
                            onChange={(e) => setLearning({ ...learning, completed: e.target.checked })}
                            className="w-5 h-5 rounded-lg border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-sm font-medium">Done</span>
                        </label>
                      </div>
                    </div>
                  </TaskCard>
                </motion.div>
              </AnimatePresence>

              <RecentHistory logs={logs} />
            </div>
          </div>
        )}
      </main>

      {/* Floating Save Button for Mobile */}
      {user && (
        <div className="fixed bottom-6 right-6 lg:hidden">
          <button 
            onClick={saveLog}
            className="w-14 h-14 bg-black text-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-transform"
          >
            <Star size={24} className="fill-white" />
          </button>
        </div>
      )}
    </div>
  );
}
