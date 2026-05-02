import React, { useState } from 'react';
import { cn } from '../lib/utils';

interface PollOption {
  id: string;
  text: string;
  votes: number;
}

interface PollCreatorProps {
  onAddPoll: (question: string, options: string[], expiresInHours?: number) => void;
  onCancel: () => void;
  className?: string;
}

export const PollCreator: React.FC<PollCreatorProps> = ({
  onAddPoll,
  onCancel,
  className
}) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [error, setError] = useState<string | null>(null);

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    } else {
      setError('Maximum 10 options allowed');
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    } else {
      setError('Minimum 2 options required');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    const validOptions = options.filter(opt => opt.trim() !== '');
    if (validOptions.length < 2) {
      setError('At least 2 options required');
      return;
    }

    if (validOptions.length !== options.length) {
      setError('All options must be filled');
      return;
    }

    onAddPoll(question.trim(), validOptions, expiresInHours);
  };

  return (
    <div className={cn('space-y-4 p-4 border dark:border-zinc-800 rounded-xl bg-gray-50 dark:bg-zinc-800/50', className)}>
      <h4 className='font-medium text-sm'>Add Poll</h4>
      
      <form onSubmit={handleSubmit} className='space-y-3'>
        <input
          type='text'
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder='Ask a question...'
          className='w-full bg-white dark:bg-zinc-900 border dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          maxLength={200}
        />

        <div className='space-y-2'>
          {options.map((option, index) => (
            <div key={index} className='flex gap-2'>
              <input
                type='text'
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                className='flex-1 bg-white dark:bg-zinc-900 border dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                maxLength={50}
              />
              {options.length > 2 && (
                <button
                  type='button'
                  onClick={() => removeOption(index)}
                  className='px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors'
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {options.length < 10 && (
          <button
            type='button'
            onClick={addOption}
            className='text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1'
          >
            + Add option
          </button>
        )}

        <div className='flex items-center gap-4'>
          <div className='flex items-center gap-2'>
            <label className='text-sm text-gray-600 dark:text-gray-400'>Expires in:</label>
            <select
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(Number(e.target.value))}
              className='bg-white dark:bg-zinc-900 border dark:border-zinc-700 rounded-lg px-2 py-1 text-sm focus:outline-none'
            >
              <option value={1}>1 hour</option>
              <option value={6}>6 hours</option>
              <option value={24}>1 day</option>
              <option value={72}>3 days</option>
              <option value={168}>1 week</option>
            </select>
          </div>
        </div>

        {error && (
          <div className='text-red-500 dark:text-red-400 text-sm'>{error}</div>
        )}

        <div className='flex gap-2 pt-2'>
          <button
            type='submit'
            className='flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors'
          >
            Add Poll
          </button>
          <button
            type='button'
            onClick={onCancel}
            className='px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors'
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

interface PollDisplayProps {
  question: string;
  options: PollOption[];
  totalVotes: number;
  userVote?: string;
  onVote: (option: string) => void;
  expiresAt?: Date;
  showResults?: boolean;
  className?: string;
}

export const PollDisplay: React.FC<PollDisplayProps> = ({
  question,
  options,
  totalVotes,
  userVote,
  onVote,
  expiresAt,
  showResults = false,
  className
}) => {
  const getPercentage = (votes: number) => {
    return totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
  };

  const isExpired = expiresAt && new Date() > expiresAt;

  return (
    <div className={cn('space-y-4 border dark:border-zinc-800 rounded-xl p-4 bg-gray-50 dark:bg-zinc-800/50', className)}>
      <h3 className='font-medium'>{question}</h3>

      {isExpired && (
        <div className='text-sm text-gray-500 dark:text-gray-400'>
          This poll has ended
        </div>
      )}

      <div className='space-y-2'>
        {options.map((option) => {
          const percentage = getPercentage(option.votes);
          const hasVoted = userVote === option.id;
          const isWinning = totalVotes > 0 && option.votes === Math.max(...options.map(o => o.votes));

          return (
            <div key={option.id} className='relative'>
              {showResults || hasVoted || isExpired ? (
                <>
                  <div className='flex items-center justify-between text-sm mb-1'>
                    <span className={cn('font-medium', isWinning && 'text-blue-600 dark:text-blue-400')}>
                      {option.text}
                    </span>
                    <span className='text-gray-500 dark:text-gray-400'>
                      {percentage}% ({option.votes} votes)
                    </span>
                  </div>
                  <div className='h-8 bg-gray-200 dark:bg-zinc-700 rounded-lg overflow-hidden'>
                    <div
                      className={cn(
                        'h-full transition-all duration-500',
                        isWinning ? 'bg-blue-500' : 'bg-gray-400 dark:bg-zinc-600'
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </>
              ) : (
                <button
                  onClick={() => onVote(option.id)}
                  className='w-full text-left p-3 rounded-lg border dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors'
                >
                  {option.text}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className='text-xs text-gray-500 dark:text-gray-400 flex justify-between'>
        <span>{totalVotes} total vote{totalVotes !== 1 ? 's' : ''}</span>
        {expiresAt && !isExpired && (
          <span>Ends in {Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))}h</span>
        )}
      </div>
    </div>
  );
};
