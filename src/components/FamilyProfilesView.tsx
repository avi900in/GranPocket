import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  ShieldCheck, 
  AlertTriangle, 
  Pill, 
  Heart, 
  FileText, 
  Calendar, 
  Lock, 
  UserPlus, 
  Edit3, 
  Trash2, 
  Check, 
  X,
  Sparkles,
  Home,
  RotateCcw,
  MessageSquareHeart,
  Star,
  Send,
  MessageSquare
} from 'lucide-react';
import { HelperInfoButton } from './HelperInfoButton';
import type { Person, Household, Language, MedicalCondition, Allergy, Medication } from '../types';
import { getAgeDisplay } from '../engine/triageEngine';
import { submitCustomerFeedback, savePersonToDb } from '../services/dbService';

interface FamilyProfilesViewProps {
  household: Household;
  members: Person[];
  selectedPerson: Person;
  onSelectPerson: (person: Person) => void;
  onUpdatePerson: (updatedPerson: Person) => void;
  onAddMember: (newPerson: Person) => void;
  language: Language;
  allHouseholds?: Household[];
  onSwitchHousehold?: (householdId: string) => void;
  onResetDemoData?: () => void;
  onDeleteMember?: (personId: string) => void;
  currentUser?: Person | null;
  canEditHousehold?: boolean;
  canManageCareLinks?: boolean;
  totalHouseholdCount?: number;
}

export const FamilyProfilesView: React.FC<FamilyProfilesViewProps> = ({
  household,
  members,
  selectedPerson,
  onSelectPerson,
  onUpdatePerson,
  onAddMember,
  language,
  allHouseholds,
  onSwitchHousehold,
  onResetDemoData,
  onDeleteMember,
  currentUser,
  canEditHousehold = false,
  canManageCareLinks = false,
  totalHouseholdCount,
}) => {
  const isRestrictedByRbac = totalHouseholdCount !== undefined && members.length < totalHouseholdCount;
  const canEditCurrentSubject = canEditHousehold || selectedPerson.id === currentUser?.id;
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Edit Profile Form State
  const [editName, setEditName] = useState(selectedPerson.name);
  const [editDob, setEditDob] = useState(selectedPerson.dob);
  const [editSex, setEditSex] = useState(selectedPerson.sex);
  const [editRelationship, setEditRelationship] = useState(selectedPerson.relationshipLabel);
  const [editPhone, setEditPhone] = useState(selectedPerson.phone || '');
  const [editPostalCode, setEditPostalCode] = useState(selectedPerson.postalCode || '');
  const [editBloodType, setEditBloodType] = useState(selectedPerson.medicalProfile.bloodType || 'O+');
  const [editWeight, setEditWeight] = useState(selectedPerson.medicalProfile.weight || 0);

  // Lists in Edit Modal
  const [conditions, setConditions] = useState<MedicalCondition[]>(selectedPerson.medicalProfile.conditions);
  const [allergies, setAllergies] = useState<Allergy[]>(selectedPerson.medicalProfile.allergies);
  const [medications, setMedications] = useState<Medication[]>(selectedPerson.medicalProfile.medications);
  const [insuranceProvider, setInsuranceProvider] = useState(selectedPerson.insurance?.provider || 'AIA');
  const [insurancePlan, setInsurancePlan] = useState(selectedPerson.insurance?.plan || 'Standard Care');
  const [policyId, setPolicyId] = useState(selectedPerson.insurance?.policyId || 'POL-12345');

  // Input states for adding new allergy/condition/medication inside edit modal
  const [newCondName, setNewCondName] = useState('');
  const [newAllergyName, setNewAllergyName] = useState('');
  const [newAllergyType, setNewAllergyType] = useState<'drug' | 'food' | 'environmental'>('drug');
  const [newAllergySeverity, setNewAllergySeverity] = useState<'mild' | 'moderate' | 'severe'>('moderate');
  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');

  // New Member Form State
  const [newName, setNewName] = useState('');
  const [newDob, setNewDob] = useState('2020-01-01');
  const [newSex, setNewSex] = useState<'male' | 'female'>('female');
  const [newRelationship, setNewRelationship] = useState('Child');

  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Caregiver Linkage State
  const [showCaregiverModal, setShowCaregiverModal] = useState(false);
  const [selectedCaregiverId, setSelectedCaregiverId] = useState('');
  const [selectedCaregiverType, setSelectedCaregiverType] = useState('primary_caregiver');
  const [isSubmittingCaregiver, setIsSubmittingCaregiver] = useState(false);

  const handleSaveCaregiverLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaregiverId) return;

    // Check if link already exists
    const existing = selectedPerson.careLinks?.find(c => c.caregiverPersonId === selectedCaregiverId);
    if (existing) {
      alert('This caregiver is already linked.');
      return;
    }

    const newLink = { caregiverPersonId: selectedCaregiverId, recipientPersonId: selectedPerson.id, type: selectedCaregiverType as any };
    const updatedLinks = [...(selectedPerson.careLinks || []), newLink];
    
    const updatedPerson = {
      ...selectedPerson,
      careLinks: updatedLinks
    };

    setIsSubmittingCaregiver(true);
    try {
      const res = await savePersonToDb(updatedPerson);
      if (res) {
        onUpdatePerson(updatedPerson);
        setShowCaregiverModal(false);
        setSaveSuccessMsg('Caregiver linked successfully and saved to DB!');
        setTimeout(() => setSaveSuccessMsg(null), 3000);
      } else {
        alert('Failed to save caregiver link to database');
      }
    } catch (err) {
      alert('Error saving to DB');
    } finally {
      setIsSubmittingCaregiver(false);
    }
  };

  // Customer Feedback Form State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackMemberName, setFeedbackMemberName] = useState(selectedPerson.name);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackCategory, setFeedbackCategory] = useState<string>('Triage & Care Advice');
  const [feedbackComments, setFeedbackComments] = useState<string>('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSuccessToast, setFeedbackSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (selectedPerson?.name) {
      setFeedbackMemberName(selectedPerson.name);
    }
  }, [selectedPerson]);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackComments.trim()) return;
    setIsSubmittingFeedback(true);
    try {
      const res = await submitCustomerFeedback({
        householdId: household.id,
        householdName: household.name,
        memberName: feedbackMemberName || selectedPerson.name,
        category: feedbackCategory,
        rating: feedbackRating,
        comments: feedbackComments.trim(),
      });
      if (res.success) {
        setShowFeedbackModal(false);
        setFeedbackComments('');
        setFeedbackRating(5);
        setFeedbackSuccessToast('Thank you! Your feedback has been stored in the database and submitted to the App Owner.');
        setTimeout(() => setFeedbackSuccessToast(null), 5000);
      } else {
        alert(res.error || 'Failed to submit feedback');
      }
    } catch (err) {
      console.error(err);
      alert('Error submitting feedback');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Open edit modal & sync values
  const handleOpenEdit = (personToEdit?: Person) => {
    const target = personToEdit || selectedPerson;
    if (personToEdit && personToEdit.id !== selectedPerson.id) {
      onSelectPerson(personToEdit);
    }
    setEditName(target.name);
    setEditDob(target.dob);
    setEditSex(target.sex);
    setEditRelationship(target.relationshipLabel);
    setEditPhone(target.phone || '');
    setEditPostalCode(target.postalCode || '');
    setEditBloodType(target.medicalProfile.bloodType || 'O+');
    setEditWeight(target.medicalProfile.weight || 0);
    setConditions([...target.medicalProfile.conditions]);
    setAllergies([...target.medicalProfile.allergies]);
    setMedications([...target.medicalProfile.medications]);
    setInsuranceProvider(target.insurance?.provider || 'Great Eastern');
    setInsurancePlan(target.insurance?.plan || 'SupremeHealth');
    setPolicyId(target.insurance?.policyId || 'POL-9988');
    setShowEditModal(true);
  };

  const handleSaveProfileEdit = (e: React.FormEvent) => {
    e.preventDefault();

    const updated: Person = {
      ...selectedPerson,
      name: editName.trim(),
      dob: editDob,
      sex: editSex,
      relationshipLabel: editRelationship,
      phone: editPhone || undefined,
      postalCode: editPostalCode || undefined,
      medicalProfile: {
        ...selectedPerson.medicalProfile,
        bloodType: editBloodType,
        weight: editWeight > 0 ? editWeight : undefined,
        conditions,
        allergies,
        medications,
        lastReviewedDate: new Date().toISOString().slice(0, 10),
      },
      insurance: {
        provider: insuranceProvider,
        plan: insurancePlan,
        policyId: policyId,
        panelStatus: 'Active Panel Cover',
      },
    };

    onUpdatePerson(updated);
    setShowEditModal(false);
    setSaveSuccessMsg(`Profile for ${updated.name} updated successfully!`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Direct removal of an allergy from the view
  const handleRemoveAllergyDirect = (allergyId: string) => {
    const updated: Person = {
      ...selectedPerson,
      medicalProfile: {
        ...selectedPerson.medicalProfile,
        allergies: selectedPerson.medicalProfile.allergies.filter(a => a.id !== allergyId),
      },
    };
    onUpdatePerson(updated);
  };

  // Direct removal of a condition
  const handleRemoveConditionDirect = (conditionId: string) => {
    const updated: Person = {
      ...selectedPerson,
      medicalProfile: {
        ...selectedPerson.medicalProfile,
        conditions: selectedPerson.medicalProfile.conditions.filter(c => c.id !== conditionId),
      },
    };
    onUpdatePerson(updated);
  };

  // Direct removal of a medication
  const handleRemoveMedicationDirect = (medicationId: string) => {
    const updated: Person = {
      ...selectedPerson,
      medicalProfile: {
        ...selectedPerson.medicalProfile,
        medications: selectedPerson.medicalProfile.medications.filter(m => m.id !== medicationId),
      },
    };
    onUpdatePerson(updated);
  };

  const handleAddNewMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newPerson: Person = {
      id: `person-${Date.now()}`,
      householdId: household.id,
      name: newName.trim(),
      dob: newDob,
      sex: newSex,
      relationshipLabel: newRelationship,
      language: 'en',
      hasLogin: false,
      systemRole: 'DEPENDENT',
      avatar: newRelationship.toLowerCase().includes('baby') ? '👶' : newRelationship.toLowerCase().includes('child') ? '👧' : '👤',
      medicalProfile: {
        conditions: [],
        allergies: [],
        intolerances: [],
        medications: [],
        vaccinations: [],
        lastReviewedDate: new Date().toISOString().slice(0, 10),
      },
    };

    onAddMember(newPerson);
    setShowAddModal(false);
    setNewName('');
    onSelectPerson(newPerson);
    setSaveSuccessMsg(`Added new household member: ${newPerson.name}`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Success alert notification */}
      {saveSuccessMsg && (
        <div className="bg-emerald-50 border-2 border-emerald-400 p-4 rounded-2xl flex items-center justify-between text-emerald-900 font-bold text-sm shadow-sm animate-fadeIn">
          <div className="flex items-center space-x-2">
            <Check className="text-emerald-600" size={18} />
            <span>{saveSuccessMsg}</span>
          </div>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Customer Feedback Success Toast */}
      {feedbackSuccessToast && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 p-4 rounded-2xl flex items-center justify-between text-amber-900 dark:text-amber-200 font-bold text-sm shadow-md animate-fadeIn">
          <div className="flex items-center space-x-2.5">
            <Sparkles className="text-amber-600 dark:text-amber-400 shrink-0" size={20} />
            <span>{feedbackSuccessToast}</span>
          </div>
          <button onClick={() => setFeedbackSuccessToast(null)} className="text-amber-700 dark:text-amber-300 hover:text-amber-900">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm">
        <div className="space-y-1">
          {allHouseholds && allHouseholds.length > 1 ? (
            <div className="flex items-center gap-2">
              <Home className="text-teal-600 shrink-0" size={20} />
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="family-select" className="sr-only">Select Family</label>
                <select
                  id="family-select"
                  value={household.id}
                  onChange={(e) => onSwitchHousehold?.(e.target.value)}
                  className="font-heading font-black text-lg sm:text-xl text-slate-900 bg-transparent border-b-2 border-teal-600 focus:outline-none cursor-pointer pr-4 hover:text-teal-800 transition-colors"
                >
                  {allHouseholds.map(h => (
                    <option key={h.id} value={h.id} className="text-slate-900 font-semibold text-sm">
                      {h.name}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200 shrink-0">
                  {members.length}/10 Members
                </span>
                <HelperInfoButton
                  title="Household Family Management"
                  content="Manage multi-generational household profiles (infants, children, adults, seniors). Tracks chronic conditions, drug/food allergies, current medications, and designated primary caregivers."
                />
              </div>
            </div>
          ) : (
            <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center space-x-2">
              <Home className="text-teal-600" size={20} />
              <span>{household.name} (10-Member Capacity)</span>
              <HelperInfoButton
                title="Household Family Management"
                content="Manage multi-generational household profiles (infants, children, adults, seniors). Tracks chronic conditions, drug/food allergies, current medications, and designated primary caregivers."
              />
            </h2>
          )}
          <p className="text-xs text-slate-500">
            Primary Home: {household.addresses[0]?.text}
          </p>
          {isRestrictedByRbac && (
            <div className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-400 font-bold mt-1">
              <ShieldCheck size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <span>RBAC Scoped: Viewing {members.length} of {totalHouseholdCount} Family Profiles (Care Recipients Only per Section 3 & 9)</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {canEditHousehold && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              disabled={members.length >= 10}
              className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow transition-all min-h-[40px]"
            >
              <UserPlus size={14} />
              <span>Add Member</span>
            </button>
          )}

          {canEditCurrentSubject ? (
            <button
              type="button"
              onClick={() => handleOpenEdit(selectedPerson)}
              className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow transition-all min-h-[40px]"
            >
              <Edit3 size={14} />
              <span>Edit Profile</span>
            </button>
          ) : (
            <span className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold border border-slate-200 min-h-[40px]">
              <Lock size={13} />
              <span>Read Only Profile</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => setShowFeedbackModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black shadow transition-all min-h-[40px]"
            title="Submit Feedback for Dr. Evelyn Lim (App Owner)"
          >
            <MessageSquareHeart size={14} />
            <span>Give Feedback</span>
          </button>

          {onResetDemoData && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Reset all households, custom members, and medication logs back to default demo state?')) {
                  onResetDemoData();
                }
              }}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              title="Reset Demo Data"
              aria-label="Reset Demo Data"
            >
              <RotateCcw size={15} />
            </button>
          )}
        </div>
      </div>



      {/* Member Cards Slider */}
      <div className="flex sm:grid sm:grid-cols-5 gap-2.5 sm:gap-3 overflow-x-auto no-scrollbar pb-1">
        {members.map(member => {
          const isSelected = member.id === selectedPerson.id;
          return (
            <div
              key={member.id}
              className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between shrink-0 w-36 sm:w-auto ${
                isSelected
                  ? 'border-teal-600 bg-teal-50/80 shadow-md ring-2 ring-teal-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectPerson(member)}
                className="w-full text-left"
              >
                <div className="text-2xl mb-1">{member.avatar || '👤'}</div>
                <div className="font-extrabold text-xs sm:text-sm text-slate-900 leading-tight truncate">
                  {member.name}
                  {member.id === currentUser?.id ? ' (Self)' : member.careLinks?.some(cl => cl.caregiverPersonId === currentUser?.id) ? ' (Care Recipient)' : ''}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  {member.relationshipLabel} • {getAgeDisplay(member.dob, language)}
                </div>
              </button>

              <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                {(canEditHousehold || member.id === currentUser?.id) ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(member)}
                      className="font-bold text-teal-700 hover:text-teal-900 hover:underline flex items-center space-x-1"
                    >
                      <Edit3 size={11} />
                      <span>Edit</span>
                    </button>
                    {currentUser?.systemRole === 'ADMIN' && member.id !== currentUser?.id && onDeleteMember && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete ${member.name}?`)) {
                            onDeleteMember(member.id);
                          }
                        }}
                        className="font-bold text-red-500 hover:text-red-700 hover:underline flex items-center space-x-1"
                        title="Delete member"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-400 font-medium flex items-center space-x-1">
                    <Lock size={11} />
                    <span>Read Only</span>
                  </span>
                )}
                {member.medicalProfile.allergies.length > 0 && (
                  <span className="text-rose-600 font-bold" title="Documented allergies">
                    ⚠️ Allergy
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Action card: Add Member */}
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          disabled={members.length >= 10}
          className="p-3 sm:p-3.5 rounded-2xl border-2 border-dashed border-teal-200 hover:border-teal-400 bg-teal-50/40 hover:bg-teal-50/80 text-teal-800 transition-all flex flex-col items-center justify-center text-center shrink-0 w-32 sm:w-auto min-h-[110px]"
        >
          <UserPlus size={22} className="text-teal-600 mb-1" />
          <span className="font-extrabold text-xs">+ Member</span>
          <span className="text-[10px] text-teal-600 font-medium">Add to family</span>
        </button>
      </div>

      {/* Selected Person Detailed Medical Record */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center space-x-3">
            <div className="text-3xl sm:text-4xl p-2 bg-slate-100 rounded-2xl shrink-0">
              {selectedPerson.avatar || '👤'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900">{selectedPerson.name}</h3>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {selectedPerson.relationshipLabel}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  DOB: {selectedPerson.dob} ({getAgeDisplay(selectedPerson.dob, language)})
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Role: <strong className="text-teal-700">{selectedPerson.systemRole}</strong> • Phone: {selectedPerson.phone || 'No phone'} • Postal: {selectedPerson.postalCode || 'N/A'} • Blood: <strong className="text-slate-800">{selectedPerson.medicalProfile.bloodType || 'O+'}</strong>
                {selectedPerson.medicalProfile.weight ? ` • Weight: ${selectedPerson.medicalProfile.weight}kg` : ''}
              </div>
            </div>
          </div>

          {/* EDIT PROFILE BUTTON */}
          <button
            onClick={() => handleOpenEdit(selectedPerson)}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all"
          >
            <Edit3 size={15} />
            <span>Edit {selectedPerson.name}'s Profile</span>
          </button>
        </div>

        {/* 4 Quadrants: Conditions, Allergies, Medications, Insurance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Quadrant 1: Conditions */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
              <span className="flex items-center space-x-1.5">
                <Heart size={15} className="text-rose-600" />
                <span>Pre-existing Conditions ({selectedPerson.medicalProfile.conditions.length})</span>
              </span>
              <button 
                onClick={() => handleOpenEdit(selectedPerson)} 
                className="text-teal-700 hover:text-teal-900 font-bold text-[11px] bg-teal-50 px-2 py-0.5 rounded border border-teal-200 flex items-center space-x-1"
              >
                <Plus size={12} />
                <span>Add / Edit</span>
              </button>
            </div>
            {selectedPerson.medicalProfile.conditions.length > 0 ? (
              <div className="space-y-2">
                {selectedPerson.medicalProfile.conditions.map(c => (
                  <div key={c.id} className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs flex justify-between items-center group">
                    <div>
                      <div className="font-bold text-slate-900">{c.name}</div>
                      <div className="text-[11px] text-slate-500">{c.type}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {c.severity && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {c.severity}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveConditionDirect(c.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                        title="Remove condition"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-white rounded-xl border border-dashed border-slate-300 text-center">
                <p className="text-xs text-slate-400 italic mb-1.5">No pre-existing conditions documented.</p>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(selectedPerson)}
                  className="text-xs font-bold text-teal-700 hover:underline"
                >
                  + Add Condition (e.g. Asthma, Stroke History)
                </button>
              </div>
            )}
          </div>

          {/* Quadrant 2: Allergies */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
              <span className="flex items-center space-x-1.5">
                <AlertTriangle size={15} className="text-amber-600" />
                <span>Allergies ({selectedPerson.medicalProfile.allergies.length})</span>
              </span>
              <button 
                onClick={() => handleOpenEdit(selectedPerson)} 
                className="text-teal-700 hover:text-teal-900 font-bold text-[11px] bg-teal-50 px-2 py-0.5 rounded border border-teal-200 flex items-center space-x-1"
              >
                <Plus size={12} />
                <span>Add / Edit</span>
              </button>
            </div>
            {selectedPerson.medicalProfile.allergies.length > 0 ? (
              <div className="space-y-2">
                {selectedPerson.medicalProfile.allergies.map(a => (
                  <div key={a.id} className="bg-white p-2.5 rounded-xl border border-rose-200 text-xs flex justify-between items-center group">
                    <div>
                      <div className="font-bold text-rose-900">{a.name}</div>
                      <div className="text-[11px] text-slate-500 capitalize">{a.type} allergy</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800">
                        {a.severity.toUpperCase()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAllergyDirect(a.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                        title="Remove allergy"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-white rounded-xl border border-dashed border-slate-300 text-center">
                <p className="text-xs text-slate-400 italic mb-1.5">No drug or food allergies documented.</p>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(selectedPerson)}
                  className="text-xs font-bold text-teal-700 hover:underline"
                >
                  + Add Allergy (e.g. Penicillin, Peanuts)
                </button>
              </div>
            )}
          </div>

          {/* Quadrant 3: Medications */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
              <span className="flex items-center space-x-1.5">
                <Pill size={15} className="text-teal-600" />
                <span>Current Medications ({selectedPerson.medicalProfile.medications.length})</span>
              </span>
              {canEditCurrentSubject && (
                <button 
                  onClick={() => handleOpenEdit(selectedPerson)} 
                  className="text-teal-700 hover:text-teal-900 font-bold text-[11px] bg-teal-50 px-2 py-0.5 rounded border border-teal-200 flex items-center space-x-1"
                >
                  <Plus size={12} />
                  <span>Add / Edit</span>
                </button>
              )}
            </div>
            {selectedPerson.medicalProfile.medications.length > 0 ? (
              <div className="space-y-2">
                {selectedPerson.medicalProfile.medications.map(m => (
                  <div key={m.id} className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs flex justify-between items-start group">
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <strong className="text-slate-900">{m.name}</strong>
                        <span className="text-teal-700 font-semibold bg-teal-50 px-1.5 py-0.5 rounded text-[10px]">{m.dose}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">{m.frequency}</div>
                      {m.indications && (
                        <div className="text-[10px] text-slate-400 italic">For: {m.indications}</div>
                      )}
                    </div>
                    {canEditCurrentSubject && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMedicationDirect(m.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors shrink-0"
                        title="Remove medication"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-white rounded-xl border border-dashed border-slate-300 text-center">
                <p className="text-xs text-slate-400 italic mb-1.5">No regular medications listed.</p>
                {canEditCurrentSubject && (
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(selectedPerson)}
                    className="text-xs font-bold text-teal-700 hover:underline"
                  >
                    + Add Medication (e.g. Paracetamol, Aspirin)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quadrant 4: Insurance Details */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
              <span className="flex items-center space-x-1.5">
                <ShieldCheck size={15} className="text-indigo-600" />
                <span>Insurance Coverage</span>
              </span>
              {canEditHousehold && (
                <button onClick={() => handleOpenEdit(selectedPerson)} className="text-teal-700 hover:underline text-[11px] font-semibold">
                  + Edit
                </button>
              )}
            </div>
            {selectedPerson.insurance ? (
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>{selectedPerson.insurance.provider}</span>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {selectedPerson.insurance.panelStatus}
                  </span>
                </div>
                <div className="text-slate-600">{selectedPerson.insurance.plan}</div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Policy ID: {selectedPerson.insurance.policyId}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No private insurance policy linked.</p>
            )}
          </div>
        </div>

        {/* Vaccinations Section */}
        <div className="border-t border-slate-200 pt-4 space-y-2">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
            <Calendar size={14} className="text-teal-700" />
            <span>Vaccination Records ({selectedPerson.medicalProfile.vaccinations.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedPerson.medicalProfile.vaccinations.map(v => (
              <span
                key={v.id}
                className="bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-xl flex items-center space-x-1.5"
              >
                <Check size={13} className="text-teal-600" />
                <span>{v.name} ({v.date})</span>
              </span>
            ))}
          </div>
        </div>

        {/* Caregiver Linkage Section */}
        <div className="border-t border-slate-200 pt-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
            <span className="flex items-center space-x-1.5">
              <Users size={14} className="text-teal-700" />
              <span>Assigned Caregivers ({selectedPerson.careLinks?.length || 0})</span>
            </span>
            {canManageCareLinks && (
              <button 
                onClick={() => setShowCaregiverModal(true)}
                className="text-teal-700 hover:text-teal-900 font-bold text-[11px] bg-teal-50 px-2 py-0.5 rounded border border-teal-200 flex items-center space-x-1"
                title="Only visible to Admins/App Owners"
              >
                <Plus size={12} />
                <span>Link Caregiver</span>
              </button>
            )}
          </div>
          {selectedPerson.careLinks && selectedPerson.careLinks.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedPerson.careLinks.map(link => {
                const caregiver = members.find(m => m.id === link.caregiverPersonId);
                return (
                  <span
                    key={link.caregiverPersonId}
                    className="bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-xl flex items-center space-x-1.5"
                  >
                    <span>{caregiver?.avatar || '👤'}</span>
                    <span>{caregiver?.name || 'Unknown'} ({link.type.replace('_', ' ')})</span>
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No caregivers explicitly linked to this person.</p>
          )}
        </div>
      </div>

      {/* CAREGIVER LINKAGE MODAL */}
      {showCaregiverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
                <Users size={18} className="text-teal-600" />
                <span>Link Caregiver to {selectedPerson.name}</span>
              </h3>
              <button onClick={() => setShowCaregiverModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveCaregiverLink} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Family Member</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  value={selectedCaregiverId}
                  onChange={(e) => setSelectedCaregiverId(e.target.value)}
                  required
                >
                  <option value="" disabled>-- Select a member --</option>
                  {members.filter(m => m.id !== selectedPerson.id).map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.relationshipLabel})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Caregiver Role</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  value={selectedCaregiverType}
                  onChange={(e) => setSelectedCaregiverType(e.target.value)}
                >
                  <option value="primary_caregiver">Primary Caregiver</option>
                  <option value="secondary_caregiver">Secondary Caregiver</option>
                  <option value="emergency_contact">Emergency Contact</option>
                </select>
              </div>
              <button 
                type="submit" 
                disabled={isSubmittingCaregiver || !selectedCaregiverId}
                className="w-full bg-teal-600 text-white font-bold py-2.5 rounded-xl hover:bg-teal-700 disabled:opacity-50"
              >
                {isSubmittingCaregiver ? 'Saving to DB...' : 'Link Caregiver'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FULL EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
                <Edit3 size={18} className="text-teal-600" />
                <span>Edit Medical Profile: {selectedPerson.name}</span>
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfileEdit} className="space-y-4">
              {/* Basic Demographics */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full mt-1 p-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Date of Birth</label>
                  <input
                    type="date"
                    required
                    value={editDob}
                    onChange={e => setEditDob(e.target.value)}
                    className="w-full mt-1 p-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Gender / Sex</label>
                  <select
                    value={editSex}
                    onChange={e => setEditSex(e.target.value as 'male' | 'female' | 'other')}
                    className="w-full mt-1 p-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:border-teal-500"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Relationship Label</label>
                  <input
                    type="text"
                    required
                    value={editRelationship}
                    onChange={e => setEditRelationship(e.target.value)}
                    placeholder="Baby / Grandpa / Mom"
                    className="w-full mt-1 p-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Blood Type</label>
                  <select
                    value={editBloodType}
                    onChange={e => setEditBloodType(e.target.value)}
                    className="w-full mt-1 p-2 rounded-xl border border-slate-300 text-xs text-slate-900"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Weight (kg)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={editWeight || ''}
                    onChange={e => setEditWeight(Number(e.target.value))}
                    placeholder="e.g. 8.9"
                    className="w-full mt-1 p-2 rounded-xl border border-slate-300 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Phone (Optional)</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    placeholder="e.g. 9123-4567"
                    className="w-full mt-1 p-2 rounded-xl border border-slate-300 text-xs text-slate-900"
                  />
                </div>
                
                <div>
                  <label className="text-xs font-bold text-slate-700">Postal Code (Optional)</label>
                  <input
                    type="text"
                    value={editPostalCode}
                    onChange={e => setEditPostalCode(e.target.value)}
                    placeholder="e.g. 123456"
                    maxLength={6}
                    className="w-full mt-1 p-2 rounded-xl border border-slate-300 text-xs text-slate-900"
                  />
                </div>
              </div>

              {/* Conditions Editor */}
              <div className="border border-slate-200 rounded-2xl p-3.5 space-y-2 bg-slate-50/50">
                <div className="text-xs font-bold text-slate-800 flex justify-between items-center">
                  <span>Pre-existing Conditions</span>
                  <span className="text-slate-400 font-normal">({conditions.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {conditions.map(c => (
                    <span key={c.id} className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs flex items-center space-x-1.5 text-slate-800">
                      <span>{c.name}</span>
                      <button
                        type="button"
                        onClick={() => setConditions(conditions.filter(item => item.id !== c.id))}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex space-x-2 pt-1">
                  <input
                    type="text"
                    placeholder="Add condition (e.g. Asthma, Diabetes)"
                    value={newCondName}
                    onChange={e => setNewCondName(e.target.value)}
                    className="flex-1 p-2 text-xs rounded-xl border border-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newCondName.trim()) return;
                      setConditions([...conditions, { id: `c-${Date.now()}`, name: newCondName.trim(), type: 'General' }]);
                      setNewCondName('');
                    }}
                    className="px-3 py-1 bg-slate-800 text-white rounded-xl text-xs font-bold"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Allergies Editor */}
              <div className="border border-slate-200 rounded-2xl p-3.5 space-y-2 bg-slate-50/50">
                <div className="text-xs font-bold text-slate-800 flex justify-between items-center">
                  <span>Allergies</span>
                  <span className="text-slate-400 font-normal">({allergies.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {allergies.map(a => (
                    <span key={a.id} className="bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg text-xs flex items-center space-x-1.5 text-rose-900">
                      <span>{a.name} ({a.severity})</span>
                      <button
                        type="button"
                        onClick={() => setAllergies(allergies.filter(item => item.id !== a.id))}
                        className="text-rose-400 hover:text-rose-700"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex space-x-2 pt-1">
                  <input
                    type="text"
                    placeholder="Allergy name (e.g. Penicillin, Peanuts)"
                    value={newAllergyName}
                    onChange={e => setNewAllergyName(e.target.value)}
                    className="flex-1 p-2 text-xs rounded-xl border border-slate-300"
                  />
                  <select
                    value={newAllergySeverity}
                    onChange={e => setNewAllergySeverity(e.target.value as any)}
                    className="p-2 text-xs rounded-xl border border-slate-300"
                  >
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newAllergyName.trim()) return;
                      setAllergies([...allergies, {
                        id: `a-${Date.now()}`,
                        name: newAllergyName.trim(),
                        type: newAllergyType,
                        severity: newAllergySeverity,
                      }]);
                      setNewAllergyName('');
                    }}
                    className="px-3 py-1 bg-slate-800 text-white rounded-xl text-xs font-bold"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Current Medications Editor */}
              <div className="border border-slate-200 rounded-2xl p-3.5 space-y-2 bg-slate-50/50">
                <div className="text-xs font-bold text-slate-800 flex justify-between items-center">
                  <span>Current Medications</span>
                  <span className="text-slate-400 font-normal">({medications.length})</span>
                </div>
                <div className="space-y-1.5">
                  {medications.map(m => (
                    <div key={m.id} className="bg-white p-2 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
                      <div>
                        <strong>{m.name}</strong> • {m.dose} ({m.frequency})
                      </div>
                      <button
                        type="button"
                        onClick={() => setMedications(medications.filter(item => item.id !== m.id))}
                        className="text-slate-400 hover:text-rose-600 font-bold px-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Medication name (e.g. Paracetamol, Aspirin)"
                    value={newMedName}
                    onChange={e => setNewMedName(e.target.value)}
                    className="p-2 text-xs rounded-xl border border-slate-300"
                  />
                  <input
                    type="text"
                    placeholder="Dose & Frequency (e.g. 3.5ml every 4-6h)"
                    value={newMedDose}
                    onChange={e => setNewMedDose(e.target.value)}
                    className="p-2 text-xs rounded-xl border border-slate-300"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!newMedName.trim()) return;
                      setMedications([...medications, {
                        id: `m-${Date.now()}`,
                        name: newMedName.trim(),
                        dose: newMedDose || 'As directed',
                        frequency: 'Daily',
                        minIntervalHours: 4,
                      }]);
                      setNewMedName('');
                      setNewMedDose('');
                    }}
                    className="px-3 py-1 bg-slate-800 text-white rounded-xl text-xs font-bold"
                  >
                    Add Medication
                  </button>
                </div>
              </div>

              {/* Insurance Details Editor */}
              <div className="border border-slate-200 rounded-2xl p-3.5 space-y-2 bg-slate-50/50">
                <div className="text-xs font-bold text-slate-800">Insurance Policy</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600">Provider</label>
                    <select
                      value={insuranceProvider}
                      onChange={e => setInsuranceProvider(e.target.value)}
                      className="w-full mt-1 p-2 rounded-xl border border-slate-300 text-xs"
                    >
                      <option value="Great Eastern">Great Eastern</option>
                      <option value="AIA">AIA</option>
                      <option value="Prudential">Prudential</option>
                      <option value="Singlife">Singlife</option>
                      <option value="NTUC Income">NTUC Income</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600">Plan</label>
                    <input
                      type="text"
                      value={insurancePlan}
                      onChange={e => setInsurancePlan(e.target.value)}
                      className="w-full mt-1 p-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600">Policy Number</label>
                    <input
                      type="text"
                      value={policyId}
                      onChange={e => setPolicyId(e.target.value)}
                      className="w-full mt-1 p-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fadeIn">
            <h3 className="text-lg font-black text-slate-900">Add Household Member</h3>
            <form onSubmit={handleAddNewMember} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Chloe Tan"
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Date of Birth</label>
                <input
                  type="date"
                  required
                  value={newDob}
                  onChange={e => setNewDob(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-300 text-sm focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700">Relationship</label>
                  <select
                    value={newRelationship}
                    onChange={e => setNewRelationship(e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-300 text-sm"
                  >
                    <option value="Baby">Baby</option>
                    <option value="Child">Child</option>
                    <option value="Teen">Teen</option>
                    <option value="Adult">Adult</option>
                    <option value="Parent">Parent</option>
                    <option value="Grandparent">Grandparent</option>
                    <option value="Helper">Helper</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Sex</label>
                  <select
                    value={newSex}
                    onChange={e => setNewSex(e.target.value as any)}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-300 text-sm"
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow"
                >
                  Create Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Feedback Modal Form */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <MessageSquareHeart size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Customer Feedback</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Direct feedback for Dr. Evelyn Lim (App Owner)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Family / Household
                </label>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span>{household.name}</span>
                  <span className="text-[10px] text-teal-600 dark:text-teal-400 uppercase font-mono font-black">{household.id}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Feedback From Member
                  </label>
                  <select
                    value={feedbackMemberName}
                    onChange={(e) => setFeedbackMemberName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {members.map(m => (
                      <option key={m.id} value={m.name}>
                        {m.name} ({m.relationshipLabel})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Feedback Category
                  </label>
                  <select
                    value={feedbackCategory}
                    onChange={(e) => setFeedbackCategory(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="Triage & Care Advice">Triage & Care Advice</option>
                    <option value="Hospital Registry & Telehealth">Hospital Registry & Telehealth</option>
                    <option value="Medication Reminder">Medication Reminder</option>
                    <option value="Emergency & Ambulance (995)">Emergency & Ambulance (995)</option>
                    <option value="App Usability & Accessibility">App Usability & Accessibility</option>
                    <option value="Other Suggestions">Other Suggestions</option>
                  </select>
                </div>
              </div>

              {/* Star Rating Selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Experience Rating ({feedbackRating} / 5 Stars)
                </label>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setFeedbackRating(star)}
                        className="p-1 hover:scale-125 transition-transform"
                        title={`${star} Star`}
                      >
                        <Star
                          size={24}
                          className={
                            star <= feedbackRating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-300 dark:text-slate-600'
                          }
                        />
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-2">
                    {feedbackRating === 5 && '🌟 Outstanding & Life-saving'}
                    {feedbackRating === 4 && '👍 Very Good Experience'}
                    {feedbackRating === 3 && '👌 Satisfactory / Average'}
                    {feedbackRating === 2 && '⚠️ Needs Clinical Improvement'}
                    {feedbackRating === 1 && '❌ Unsatisfactory'}
                  </span>
                </div>
              </div>

              {/* Comments / Details */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Comments & Feedback Details
                </label>
                <textarea
                  rows={3}
                  required
                  value={feedbackComments}
                  onChange={(e) => setFeedbackComments(e.target.value)}
                  placeholder="Share what worked well (e.g. triage accuracy, wait times) or any suggestions for Dr. Evelyn Lim and the care team..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFeedback || !feedbackComments.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl text-xs font-black shadow-md hover:shadow-lg disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {isSubmittingFeedback ? (
                    <span>Submitting...</span>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Submit to App Owner</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
