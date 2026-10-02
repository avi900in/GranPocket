import React, { useState } from 'react';
import { 
  MessageSquareHeart, 
  Star, 
  Send, 
  X,
  Sparkles
} from 'lucide-react';
import type { Household, Person } from '../types';
import { submitCustomerFeedback } from '../services/dbService';

interface CustomerFeedbackViewProps {
  household: Household;
  members: Person[];
  selectedPerson: Person;
}

export const CustomerFeedbackView: React.FC<CustomerFeedbackViewProps> = ({
  household,
  members,
  selectedPerson
}) => {
  const [feedbackMemberName, setFeedbackMemberName] = useState(selectedPerson.name);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackCategory, setFeedbackCategory] = useState<string>('Triage & Care Advice');
  const [feedbackComments, setFeedbackComments] = useState<string>('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSuccessToast, setFeedbackSuccessToast] = useState<string | null>(null);

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
        setFeedbackComments('');
        setFeedbackRating(5);
        setFeedbackSuccessToast('Thank you! Your feedback has been stored in the database.');
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

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn pb-12">
      {feedbackSuccessToast && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-400 p-4 rounded-2xl flex items-center justify-between text-emerald-900 dark:text-emerald-200 font-bold text-sm shadow-md animate-fadeIn">
          <div className="flex items-center space-x-2.5">
            <Sparkles className="text-emerald-600 dark:text-emerald-400 shrink-0" size={20} />
            <span>{feedbackSuccessToast}</span>
          </div>
          <button onClick={() => setFeedbackSuccessToast(null)} className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <MessageSquareHeart size={26} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Customer Feedback</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Share your thoughts and suggestions with our care team.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleFeedbackSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Family / Household
            </label>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span>{household.name}</span>
              <span className="text-xs text-teal-600 dark:text-teal-400 uppercase font-mono font-black">{household.id}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Feedback From Member
              </label>
              <select
                value={feedbackMemberName}
                onChange={(e) => setFeedbackMemberName(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {members.map(m => (
                  <option key={m.id} value={m.name}>
                    {m.name} ({m.relationshipLabel})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Feedback Category
              </label>
              <select
                value={feedbackCategory}
                onChange={(e) => setFeedbackCategory(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
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

          <div>
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-2">
              Experience Rating ({feedbackRating} / 5 Stars)
            </label>
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setFeedbackRating(star)}
                    className="p-1 hover:scale-125 transition-transform"
                    title={`${star} Star`}
                  >
                    <Star
                      size={28}
                      className={
                        star <= feedbackRating
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-300 dark:text-slate-600'
                      }
                    />
                  </button>
                ))}
              </div>
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300 ml-3">
                {feedbackRating === 5 && '🌟 Outstanding'}
                {feedbackRating === 4 && '👍 Very Good Experience'}
                {feedbackRating === 3 && '👌 Satisfactory / Average'}
                {feedbackRating === 2 && '⚠️ Needs Improvement'}
                {feedbackRating === 1 && '❌ Unsatisfactory'}
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Comments & Feedback Details
            </label>
            <textarea
              rows={4}
              required
              value={feedbackComments}
              onChange={(e) => setFeedbackComments(e.target.value)}
              placeholder="Share what worked well (e.g. triage accuracy, wait times) or any suggestions for the care team..."
              className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-400"
            />
          </div>

          <div className="pt-4 flex items-center justify-end">
            <button
              type="submit"
              disabled={isSubmittingFeedback || !feedbackComments.trim()}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl text-sm font-black shadow-md hover:shadow-lg disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {isSubmittingFeedback ? (
                <span>Submitting...</span>
              ) : (
                <>
                  <Send size={16} />
                  <span>Submit Feedback</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
