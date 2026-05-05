import React, { useState, useEffect } from 'react';
import { 
  format, 
  addDays, 
  startOfWeek, 
  isSameDay,
  startOfMonth,
  getDaysInMonth
} from 'date-fns';
import { uz } from 'date-fns/locale';
import { 
  Bell, 
  Search, 
  Plus, 
  Check, 
  MoreHorizontal, 
  Clock,
  LogOut,
  Archive,
  Trash2,
  X,
  Bell
} from 'lucide-react';
import Auth from './Auth';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

interface Task {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  isCompleted: boolean;
  categoryColor: string;
  date: Date;
  isRecurring?: boolean;
  recurringDays?: number[];
  isArchived?: boolean;
  isFailed?: boolean;
  isNotified?: boolean;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);

  const [isAddingTask, setIsAddingTask] = useState(false);
  const [taskType, setTaskType] = useState<'oddiy' | 'doimiy'>('oddiy');
  const [calendarView, setCalendarView] = useState<'xafta' | 'oy'>('xafta');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskStartTime, setNewTaskStartTime] = useState('09:00');
  const [newTaskEndTime, setNewTaskEndTime] = useState('10:00');
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeNotification, setActiveNotification] = useState<Task | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user || activeNotification) return;

    const h = currentTime.getHours();
    const m = currentTime.getMinutes();
    const currentMins = h * 60 + m;
    const currentDay = currentTime.getDay();
    const isToday = (d: Date) => d.getDate() === currentTime.getDate() && d.getMonth() === currentTime.getMonth() && d.getFullYear() === currentTime.getFullYear();
    
    const overdueTask = tasks.find(t => {
      if (t.isCompleted || t.isArchived || t.isFailed || t.isNotified) return false;
      const [th, tm] = t.endTime.split(':').map(Number);
      const endMins = th * 60 + tm;
      if (currentMins >= endMins) {
        if (t.isRecurring && t.recurringDays) {
          return t.recurringDays.includes(currentDay);
        } else {
          return isToday(t.date);
        }
      }
      return false;
    });

    if (overdueTask) {
      setActiveNotification(overdueTask);
    }
  }, [currentTime, tasks, user, activeNotification]);

  const handleNotificationAction = async (status: 'completed' | 'failed' | 'dismiss') => {
    if (!activeNotification || !user) return;
    const taskId = activeNotification.id;
    setActiveNotification(null);

    try {
      if (status === 'dismiss') {
         await updateDoc(doc(db, `users/${user.uid}/tasks`, taskId), { isNotified: true });
      } else {
         await updateDoc(doc(db, `users/${user.uid}/tasks`, taskId), {
           isCompleted: status === 'completed',
           isFailed: status === 'failed',
           isNotified: true
         });
      }
    } catch (e) {
      console.error("Error updating notification status:", e);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingAuth(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      return;
    }
    const q = query(collection(db, `users/${user.uid}/tasks`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbTasks = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          ...data,
          id: docSnap.id,
          date: new Date(data.date)
        } as Task;
      });
      setTasks(dbTasks);
    }, (error) => {
      console.error("Error fetching tasks:", error);
    });
    return () => unsubscribe();
  }, [user]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth onSuccess={() => {}} />;
  }

  // Generate calendar dates
  let calendarDates: Date[] = [];
  if (calendarView === 'xafta') {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Start Monday
    calendarDates = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  } else {
    const monthStart = startOfMonth(selectedDate);
    const daysInMonth = getDaysInMonth(monthStart);
    calendarDates = Array.from({ length: daysInMonth }).map((_, i) => addDays(monthStart, i));
  }

  const filteredTasks = tasks
    .filter(task => {
      if (task.isArchived) return false;
      if (isSearching && searchQuery.trim() !== '') {
        return task.title.toLowerCase().includes(searchQuery.toLowerCase());
      }
      if (task.isRecurring && task.recurringDays) {
        return task.recurringDays.includes(selectedDate.getDay());
      }
      return isSameDay(task.date, selectedDate);
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const toggleTask = async (taskId: string) => {
    if (!user) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      await updateDoc(doc(db, `users/${user.uid}/tasks`, taskId), {
        isCompleted: !task.isCompleted
      });
    } catch (e) {
      console.error("Error toggling task:", e);
    }
  };

  const archiveTask = async (taskId: string) => {
    if (!user) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      await updateDoc(doc(db, `users/${user.uid}/tasks`, taskId), {
        isArchived: !task.isArchived
      });
    } catch (e) {
      console.error("Error archiving task:", e);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/tasks`, taskId));
    } catch (e) {
      console.error("Error deleting task:", e);
    }
  };

  const addTask = async () => {
    if (!newTaskTitle.trim() || !user) return;
    if (taskType === 'doimiy' && recurringDays.length === 0) return;
    
    const colors = ['bg-blue-400', 'bg-purple-400', 'bg-pink-400', 'bg-orange-400', 'bg-green-400'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const newTaskData: any = {
      title: newTaskTitle,
      description: newTaskDescription,
      startTime: newTaskStartTime,
      endTime: newTaskEndTime,
      isCompleted: false,
      categoryColor: randomColor,
      date: selectedDate.toISOString(),
      createdAt: serverTimestamp()
    };

    if (taskType === 'doimiy') {
      newTaskData.isRecurring = true;
      newTaskData.recurringDays = recurringDays;
    }

    try {
      const newRef = doc(collection(db, `users/${user.uid}/tasks`));
      await setDoc(newRef, newTaskData);
      
      setNewTaskTitle('');
      setNewTaskDescription('');
      setTaskType('oddiy');
      setRecurringDays([]);
      setIsAddingTask(false);
    } catch (e) {
      console.error("Error adding task:", e);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="relative min-h-screen sm:max-w-md sm:mx-auto overflow-hidden font-sans text-white">
      {/* Animated Background Orbs */}
      <div className="orb w-[400px] h-[400px] bg-purple-600 top-[-100px] left-[-50px] opacity-40"></div>
      <div className="orb w-[500px] h-[500px] bg-blue-500 bottom-[-150px] right-[-50px] opacity-30"></div>
      <div className="orb w-[300px] h-[300px] bg-pink-500 top-[20%] right-[-100px] opacity-20"></div>

      {/* Main Content Overlay */}
      <div className="relative z-10 flex flex-col h-screen overflow-y-auto hide-scrollbar px-6 py-10">
        
        {/* Notification Banner */}
        {activeNotification && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-sm bg-indigo-900/95 backdrop-blur-xl border border-indigo-500/50 p-4 rounded-3xl shadow-2xl shadow-indigo-900/50 z-50 flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/30 rounded-full">
                  <Bell className="text-indigo-200" size={16} />
                </div>
                <h4 className="font-bold text-white text-sm">Vazifa yakunlandi</h4>
              </div>
              <button onClick={() => handleNotificationAction('dismiss')} className="text-white/50 hover:text-white p-1 rounded-full transition-colors">
                <X size={16} />
              </button>
            </div>
            <p className="text-sm font-medium text-indigo-100 px-1">{activeNotification.title}</p>
            <p className="text-xs font-bold text-indigo-300 px-1 -mt-2">{activeNotification.startTime} - {activeNotification.endTime}</p>
            
            <p className="text-xs font-semibold text-white/50 px-1 mt-1">Vazifa muvaffaqiyatli bajarildimi?</p>
            <div className="flex gap-2">
              <button 
                onClick={() => handleNotificationAction('completed')}
                className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-300 py-2 rounded-xl text-sm font-bold border border-green-500/30 transition-all flex justify-center items-center gap-1"
              >
                <Check size={14} /> Bajarildi
              </button>
              <button 
                onClick={() => handleNotificationAction('failed')}
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 py-2 rounded-xl text-sm font-bold border border-red-500/30 transition-all flex justify-center items-center gap-1"
              >
                <X size={14} /> Bajarilmadi
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          {isSearching ? (
            <div className="flex-1 flex gap-3 h-10 items-center">
              <input 
                 autoFocus
                 type="text"
                 placeholder="Vazifa nomi bo'yicha qidirish..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="flex-1 bg-white/10 border border-white/20 rounded-full h-full px-4 outline-none focus:ring-1 focus:ring-white/50 placeholder:text-white/40 text-white font-medium text-sm transition-all"
              />
              <button 
                onClick={() => {
                  setIsSearching(false);
                  setSearchQuery('');
                }}
                className="text-white/60 hover:text-white text-sm font-semibold transition-colors shrink-0"
              >
                Bekor
              </button>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-white/80 text-sm font-semibold uppercase tracking-wider mb-2">
                  {user?.displayName ? user.displayName : "Salom, Do'stim"} 👋
                </h2>
                <h1 className="text-white text-4xl font-bold tracking-tight tabular-nums">
                  {new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(currentTime)}
                </h1>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsSearching(true)}
                  className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <Search size={20} className="text-white" />
                </button>
                <button onClick={handleLogout} className="w-10 h-10 rounded-full border border-white/20 relative flex items-center justify-center hover:bg-white/10 transition-colors">
                  <LogOut size={20} className="text-white" />
                </button>
              </div>
            </>
          )}
        </header>

        {/* Horizontal Calendar -- hidden when searching */}
        {!isSearching && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white/80 text-lg font-semibold tabular-nums tracking-widest">{format(selectedDate, 'dd.MM.yyyy')}</h3>
            <div className="flex bg-white/10 p-1 rounded-xl w-36">
              <button 
                onClick={() => {
                  setCalendarView('xafta');
                  setSelectedDate(new Date());
                }}
                className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all duration-300 ${calendarView === 'xafta' ? 'bg-white text-black shadow-md' : 'text-white/60 hover:text-white'}`}
              >
                Xafta
              </button>
              <button 
                onClick={() => setCalendarView('oy')}
                className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all duration-300 ${calendarView === 'oy' ? 'bg-white text-black shadow-md' : 'text-white/60 hover:text-white'}`}
              >
                Oy
              </button>
            </div>
          </div>
          
          <div className={`flex ${calendarView === 'xafta' ? 'justify-between' : 'justify-start'} gap-1 sm:gap-2 overflow-x-auto hide-scrollbar pb-2`}>
            {calendarDates.map((date, i) => {
              const isSelected = isSameDay(date, selectedDate);
              const isToday = isSameDay(date, new Date());
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(date)}
                  className={`flex flex-col items-center justify-center flex-1 min-w-[2.75rem] py-3 rounded-2xl transition-all duration-300 ${
                    isSelected 
                      ? 'bg-white text-black scale-105 transform shadow-lg shadow-white/10' 
                      : 'glass-card text-white/80 hover:bg-white/20'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold mb-1 opacity-80">
                    {format(date, 'eee', { locale: uz }).substring(0, 3)}
                  </span>
                  <span className="text-lg font-black">
                    {format(date, 'd')}
                  </span>
                  {isToday && !isSelected && (
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* Tasks Section */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white text-xs font-bold uppercase tracking-widest opacity-50">
              {isSearching ? 'Qidiruv natijalari' : 'Bugungi reja'}
            </h3>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full glass-card">
              {filteredTasks.filter(t => t.isCompleted).length} / {filteredTasks.length}
            </span>
          </div>

          <div className="space-y-4 pb-24">
            {filteredTasks.length === 0 ? (
               <div className="glass-card p-8 rounded-3xl text-center flex flex-col items-center justify-center">
                 <div className="w-16 h-16 mb-4 rounded-full border border-white/20 flex items-center justify-center bg-white/5">
                   <Clock className="text-white/60" size={28} />
                 </div>
                 <p className="text-white/60 font-medium">
                   {isSearching ? 'Bunday vazifa topilmadi' : "Bu kunga reja yo'q"}
                 </p>
               </div>
            ) : (
              filteredTasks.map(task => (
                <div 
                  key={task.id} 
                  className={`glass-card p-4 rounded-3xl flex items-center gap-4 transition-all duration-300 ${
                    task.isCompleted ? 'opacity-50' : ''
                  }`}
                >
                  {/* Category color strip */}
                  <div className={`w-1.5 h-12 ${task.categoryColor} rounded-full`}></div>
                  
                  {/* Task details */}
                  <div className="flex-1 w-full overflow-hidden">
                    <p className="text-white/40 text-[10px] font-bold uppercase truncate">{task.startTime} - {task.endTime}</p>
                    <h4 className={`font-semibold text-[15px] transition-all text-white truncate ${
                      task.isCompleted ? 'line-through opacity-80' : ''
                    }`}>
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-white/60 text-xs truncate mt-0.5">{task.description}</p>
                    )}
                    {isSearching && (
                      <p className="text-purple-300/70 text-[11px] mt-1 pr-2 truncate font-medium">
                        {task.isRecurring && task.recurringDays
                          ? `Kunlar: ${task.recurringDays.map(d => ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'][d]).join(', ')}`
                          : `Sana: ${format(task.date, 'dd.MM.yyyy')}`
                        }
                      </p>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2 mr-1">
                    <button 
                      onClick={() => archiveTask(task.id)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                      title="Arxivlash"
                    >
                      <Archive size={16} />
                    </button>
                    <button 
                      onClick={() => deleteTask(task.id)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                      title="O'chirish"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  {/* Checkbox */}
                  <button 
                    onClick={() => toggleTask(task.id)}
                    className={`w-6 h-6 rounded-full border flex justify-center items-center flex-shrink-0 transition-colors ${
                      task.isCompleted 
                        ? 'bg-white text-black border-white' 
                        : task.isFailed
                        ? 'bg-red-500/80 border-red-500 text-white'
                        : 'border-white/30 hover:bg-white/10'
                    }`}
                  >
                    {task.isCompleted && <div className="w-2.5 h-2.5 bg-black rounded-full"></div>}
                    {task.isFailed && <X size={14} className="text-white stroke-[3px]" />}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Quick Add Modal/Overlay */}
      {isAddingTask && (
        <div className="absolute inset-0 z-40 bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div className="glass w-full max-w-sm rounded-[2rem] p-6 mb-8 sm:mb-0 transform transition-all border border-white/20">
            <div className="flex bg-white/10 p-1 rounded-xl mb-6">
              <button 
                onClick={() => setTaskType('oddiy')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-300 ${taskType === 'oddiy' ? 'bg-white text-black shadow-md' : 'text-white/60 hover:text-white'}`}
              >
                Oddiy vazifa
              </button>
              <button 
                onClick={() => setTaskType('doimiy')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-300 ${taskType === 'doimiy' ? 'bg-white text-black shadow-md' : 'text-white/60 hover:text-white'}`}
              >
                Doimiy ish
              </button>
            </div>

            <input 
              type="text" 
              placeholder="Nima qilasiz?"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 mb-3 outline-none focus:ring-1 focus:ring-white/50 placeholder:text-white/40 text-white font-medium"
              autoFocus
            />
            <textarea
              placeholder="Izoh (ixtiyoriy)"
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 mb-4 outline-none focus:ring-1 focus:ring-white/50 placeholder:text-white/40 text-white text-sm resize-none h-20"
            />
            
            {taskType === 'doimiy' && (
              <div className="mb-5">
                <label className="text-[10px] text-white/50 uppercase font-bold ml-1 mb-2 block">Kunlarni tanlang</label>
                <div className="flex justify-between gap-1">
                  {[1, 2, 3, 4, 5, 6, 0].map(day => {
                    const dayNames = ['Yk', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
                    const isSelected = recurringDays.includes(day);
                    return (
                      <button
                        key={day}
                        onClick={() => {
                          if (isSelected) {
                            setRecurringDays(recurringDays.filter(d => d !== day));
                          } else {
                            setRecurringDays([...recurringDays, day]);
                          }
                        }}
                        className={`w-9 h-9 rounded-full text-xs font-bold transition-all ${
                          isSelected ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' : 'bg-white/10 text-white/50 hover:bg-white/20 hover:text-white'
                        }`}
                      >
                        {dayNames[day]}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-[10px] text-white/50 uppercase font-bold ml-1 mb-1 block">Boshlanish</label>
                <input 
                  type="time" 
                  value={newTaskStartTime}
                  onChange={(e) => setNewTaskStartTime(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 outline-none focus:ring-1 focus:ring-white/50 text-white [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 uppercase font-bold ml-1 mb-1 block">Tugash</label>
                <input 
                  type="time" 
                  value={newTaskEndTime}
                  onChange={(e) => setNewTaskEndTime(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 outline-none focus:ring-1 focus:ring-white/50 text-white [color-scheme:dark]"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsAddingTask(false)}
                className="flex-1 py-3.5 rounded-2xl font-semibold text-white bg-white/10 hover:bg-white/20 transition-colors border border-white/10"
              >
                Bekor qilish
              </button>
              <button 
                onClick={addTask}
                className="flex-1 py-3.5 rounded-2xl font-semibold text-slate-900 bg-white hover:bg-white/90 transition-opacity"
              >
                Qo'shish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button 
        onClick={() => setIsAddingTask(true)}
        className="absolute z-30 bottom-8 right-8 w-14 h-14 rounded-full bg-white text-black shadow-lg shadow-white/20 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
      >
        <Plus size={30} strokeWidth={2.5} />
      </button>

    </div>
  );
}
