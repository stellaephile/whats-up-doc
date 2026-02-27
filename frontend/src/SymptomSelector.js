import { useState } from 'react';
import { symptomOptions, assessmentService } from './symptomAssessment';

function SymptomSelector({ onAssessmentComplete }) {
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isAssessing, setIsAssessing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Get unique categories
  const categories = ['all', ...new Set(symptomOptions.map(s => s.category))];

  // Filter symptoms by category
  const filteredSymptoms = selectedCategory === 'all' 
    ? symptomOptions 
    : symptomOptions.filter(s => s.category === selectedCategory);

  const handleSymptomToggle = (symptomId) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptomId)
        ? prev.filter(id => id !== symptomId)
        : [...prev, symptomId]
    );
  };

  const handleAssess = async () => {
    if (selectedSymptoms.length === 0 && !additionalNotes.trim()) {
      alert('Please select at least one symptom or describe your condition');
      return;
    }

    setIsAssessing(true);
    try {
      const result = await assessmentService.assess(selectedSymptoms, additionalNotes);
      onAssessmentComplete(result);
    } catch (error) {
      console.error('Assessment failed:', error);
      alert('Assessment failed. Please try again.');
    } finally {
      setIsAssessing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          What symptoms are you experiencing?
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Select all that apply. We'll recommend the right type of facility.
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 justify-center">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedCategory === category
                ? 'bg-primary text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {category === 'all' ? 'All Symptoms' : category}
          </button>
        ))}
      </div>

      {/* Symptom Grid */}
      <div className="bg-white dark:bg-surface-dark rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
          {filteredSymptoms.map(symptom => {
            const isSelected = selectedSymptoms.includes(symptom.id);
            const severityColor = 
              symptom.severity >= 9 ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
              symptom.severity >= 7 ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' :
              symptom.severity >= 4 ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
              'border-green-500 bg-green-50 dark:bg-green-900/20';

            return (
              <button
                key={symptom.id}
                onClick={() => handleSymptomToggle(symptom.id)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  isSelected
                    ? `${severityColor} shadow-md scale-105`
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-primary'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {symptom.label}
                  </span>
                  {isSelected && (
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      check_circle
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                  {symptom.category}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Additional Notes */}
      <div className="bg-white dark:bg-surface-dark rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700">
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Additional Details (Optional)
        </label>
        <textarea
          value={additionalNotes}
          onChange={(e) => setAdditionalNotes(e.target.value)}
          placeholder="Describe your symptoms in more detail... (e.g., 'Started 2 days ago', 'Getting worse', 'Can't breathe properly')"
          className="w-full h-24 px-4 py-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 resize-none"
        />
      </div>

      {/* Selected Count */}
      {selectedSymptoms.length > 0 && (
        <div className="text-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold text-sm">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            {selectedSymptoms.length} symptom{selectedSymptoms.length !== 1 ? 's' : ''} selected
          </span>
        </div>
      )}

      {/* Assess Button */}
      <button
        onClick={handleAssess}
        disabled={isAssessing}
        className="w-full h-14 bg-primary hover:bg-primary-dark text-white font-bold text-lg rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isAssessing ? (
          <>
            <span className="animate-spin material-symbols-outlined">refresh</span>
            Assessing...
          </>
        ) : (
          <>
            <span className="material-symbols-outlined">medical_services</span>
            Find Appropriate Facilities
          </>
        )}
      </button>

      {/* Emergency Notice */}
      <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-red-600 text-[24px]">emergency</span>
          <div className="flex-1">
            <h3 className="font-bold text-red-900 dark:text-red-400 mb-1">
              Life-Threatening Emergency?
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 mb-3">
              If you're experiencing chest pain, difficulty breathing, severe bleeding, or loss of consciousness, call emergency services immediately.
            </p>
            <a
              href="tel:108"
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">call</span>
              Call 108 Emergency
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SymptomSelector;
