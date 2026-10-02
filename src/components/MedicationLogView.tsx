import React, { useState } from 'react';
import { 
  Pill, 
  Plus, 
  Clock, 
  AlertTriangle, 
  Camera, 
  Check, 
  User, 
  ShieldAlert, 
  Bell, 
  Calendar,
  X,
  Sparkles
} from 'lucide-react';
import type { MedicationLogEntry, Person, Language } from '../types';
import { getDuplicateDoseWarning } from '../engine/grandmaVoice';

interface MedicationLogViewProps {
  logs: MedicationLogEntry[];
  members: Person[];
  selectedPerson: Person;
  onAddLog: (log: MedicationLogEntry) => void;
  language: Language;
}

export const MedicationLogView: React.FC<MedicationLogViewProps> = ({
  logs,
  members,
  selectedPerson,
  onAddLog,
  language,
}) => {
  const [showLogModal, setShowLogModal] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    medicine: string;
    lastGivenFormatted: string;
    minHours: number;
  } | null>(null);

  // New Log Form
  const [medSubjectId, setMedSubjectId] = useState(selectedPerson.id);
  const [medName, setMedName] = useState('Infant Paracetamol Suspension (120mg/5ml)');
  const [medDose, setMedDose] = useState('3.5 ml');
  const [givenBy, setGivenBy] = useState('Sarah Tan (Mom)');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Filter logs for selected person or all
  const [filterPersonId, setFilterPersonId] = useState<string>('all');
  const filteredLogs = filterPersonId === 'all'
    ? logs
    : logs.filter(l => l.subjectId === filterPersonId);

  // Quick helper to calculate time elapsed
  const getTimeElapsed = (dateIso: string): string => {
    const diffMs = Date.now() - new Date(dateIso).getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 1) {
      const mins = Math.max(1, Math.round(diffMs / (1000 * 60)));
      return `${mins} mins ago`;
    }
    const roundedHours = Math.round(diffHours * 10) / 10;
    return `${roundedHours} hours ago`;
  };

  const handleAttemptLog = (e: React.FormEvent) => {
    e.preventDefault();

    // Check for Duplicate-Dose Warning (SRS MED-04)
    // Find last given entry of the same medicine for the same subject
    const prevLog = logs.find(
      l => l.subjectId === medSubjectId &&
           l.medicine.toLowerCase().includes(medName.toLowerCase().slice(0, 8))
    );

    if (prevLog) {
      const elapsedHours = (Date.now() - new Date(prevLog.givenAt).getTime()) / (1000 * 60 * 60);
      const minInterval = 4.0; // 4 hours standard for paracetamol/fever meds

      if (elapsedHours < minInterval) {
        setDuplicateWarning({
          medicine: medName,
          lastGivenFormatted: `${getTimeElapsed(prevLog.givenAt)} (${new Date(prevLog.givenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
          minHours: minInterval,
        });
        return;
      }
    }

    commitLog();
  };

  const commitLog = () => {
    const targetMember = members.find(m => m.id === medSubjectId) || selectedPerson;
    const newEntry: MedicationLogEntry = {
      id: `medlog-${Date.now()}`,
      subjectId: medSubjectId,
      subjectName: targetMember.name,
      givenBy,
      medicine: medName,
      dose: medDose,
      givenAt: new Date().toISOString(),
      photoUrl: photoUrl || undefined,
      notes: notes || undefined,
    };

    onAddLog(newEntry);
    setDuplicateWarning(null);
    setShowLogModal(false);
    setNotes('');
    setPhotoUrl(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center space-x-2">
            <Pill className="text-teal-600" size={22} />
            <span>Shared Medication Log & Safety</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time household visibility • Prevents accidental double-dosing (especially for infants and elderly)
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Filter by subject */}
          <select
            value={filterPersonId}
            onChange={e => setFilterPersonId(e.target.value)}
            className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold"
          >
            <option value="all">All Family Members</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          <button
            onClick={() => {
              setMedSubjectId(selectedPerson.id);
              setShowLogModal(true);
            }}
            className="flex items-center space-x-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow transition-all"
          >
            <Plus size={15} />
            <span>Log Medicine Given</span>
          </button>
        </div>
      </div>

      {/* Duplicate-Dose Test Trigger Pill */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2.5">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <div>
            <span className="font-bold text-amber-950">Duplicate-Dose Safety Demonstration (E2E-03): </span>
            <span className="text-amber-800">
              Lucas was given Infant Paracetamol 1.5 hours ago. Try logging another dose now to test safety interception!
            </span>
          </div>
        </div>
        <button
          onClick={() => {
            setMedSubjectId('person-lucas');
            setMedName('Infant Paracetamol Suspension (120mg/5ml)');
            setMedDose('3.5 ml');
            setShowLogModal(true);
          }}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-sm transition-all"
        >
          Test Double-Dose Alert →
        </button>
      </div>

      {/* Medication Timeline */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
          <Clock size={16} className="text-teal-700" />
          <span>Medication History & Time Elapsed ({filteredLogs.length})</span>
        </h3>

        {filteredLogs.length > 0 ? (
          <div className="space-y-3">
            {filteredLogs.map(log => {
              const elapsed = getTimeElapsed(log.givenAt);
              const isRecent = (Date.now() - new Date(log.givenAt).getTime()) < 4 * 60 * 60 * 1000;

              return (
                <div
                  key={log.id}
                  className="border border-slate-200 hover:border-teal-300 rounded-2xl p-4 bg-slate-50/50 hover:bg-white transition-all space-y-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-sm text-slate-900">{log.medicine}</span>
                        <span className="font-bold text-xs text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded-full">
                          {log.dose}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        For: <span className="font-semibold text-slate-800">{log.subjectName}</span> • Administered by: <span className="font-semibold">{log.givenBy}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-xs font-black px-2.5 py-1 rounded-full inline-block ${
                        isRecent ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-600'
                      }`}>
                        ⏳ {elapsed}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(log.givenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.givenAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {log.notes && (
                    <div className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/80">
                      📝 {log.notes}
                    </div>
                  )}

                  {log.photoUrl && (
                    <div className="flex items-center space-x-2 pt-1">
                      <img
                        src={log.photoUrl}
                        alt="Medication verification photo"
                        className="w-16 h-16 object-cover rounded-xl border border-slate-300 shadow-sm"
                      />
                      <span className="text-[11px] text-slate-500 font-medium">
                        📷 Dose packaging & syringe verified by photo
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic text-center py-6">No medication entries recorded yet.</p>
        )}
      </div>

      {/* Log Dose Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
                <Pill className="text-teal-600" size={18} />
                <span>Log Medication Administered</span>
              </h3>
              <button onClick={() => setShowLogModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            {/* Grandma Warning Popup if duplicate check tripped! */}
            {duplicateWarning ? (
              <div className="space-y-4 animate-fadeIn">
                <div className="bg-rose-50 border-2 border-rose-400 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center space-x-2 text-rose-900 font-black text-sm">
                    <ShieldAlert size={20} className="text-rose-600 shrink-0" />
                    <span>Grandma Safety Warning: Duplicate Dose Detected!</span>
                  </div>
                  <p className="text-xs text-rose-950 leading-relaxed">
                    {getDuplicateDoseWarning(
                      duplicateWarning.medicine,
                      duplicateWarning.lastGivenFormatted,
                      duplicateWarning.minHours,
                      language
                    )}
                  </p>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    onClick={() => setDuplicateWarning(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Cancel / Review Dose
                  </button>
                  <button
                    onClick={commitLog}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow"
                  >
                    Doctor Authorized (Proceed Anyway)
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAttemptLog} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-700">Who received this medication?</label>
                  <select
                    value={medSubjectId}
                    onChange={e => setMedSubjectId(e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-300 text-sm"
                  >
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.relationshipLabel})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Medicine Name</label>
                  <input
                    type="text"
                    required
                    value={medName}
                    onChange={e => setMedName(e.target.value)}
                    placeholder="e.g. Infant Paracetamol or Aspirin"
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Dose Given</label>
                    <input
                      type="text"
                      required
                      value={medDose}
                      onChange={e => setMedDose(e.target.value)}
                      placeholder="e.g. 3.5 ml or 1 tablet"
                      className="w-full mt-1 p-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">Administered By</label>
                    <input
                      type="text"
                      required
                      value={givenBy}
                      onChange={e => setGivenBy(e.target.value)}
                      className="w-full mt-1 p-2.5 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                </div>

                {/* Photo Upload Simulation */}
                <div>
                  <label className="text-xs font-bold text-slate-700">Verification Photo (Bottle / Syringe)</label>
                  <div className="mt-1 flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=60')}
                      className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium border border-slate-200"
                    >
                      <Camera size={14} />
                      <span>Attach Syringe Photo</span>
                    </button>
                    {photoUrl && <span className="text-xs font-semibold text-emerald-600">✓ Attached</span>}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Observations / Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Fever 38.8C before dose. Given after milk."
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-500"
                  />
                </div>

                <div className="pt-3 flex justify-end space-x-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowLogModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow"
                  >
                    Record Dose
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
