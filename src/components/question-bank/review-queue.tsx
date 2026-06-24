'use client';

import React, { useEffect, useState } from 'react';

interface Question {
  id: string;
  questionText: string;
  type: string;
  difficulty: string;
  options: { key: string; text: string }[];
  correctAnswer: string;
  explanation: string | null;
  tags: string[];
  status: string;
  sourceDocId: string | null;
}

interface ReviewQueueProps {
  bankId: string;
  accessToken: string;
  onReviewed: () => void;
}

export function ReviewQueue({ bankId, accessToken, onReviewed }: ReviewQueueProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchReview = async () => {
    setLoading(true);
    const res = await fetch(`/api/question-banks/${bankId}/questions?status=review&limit=50`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    if (json.success) setQuestions(json.data);
    setLoading(false);
  };

  useEffect(() => { fetchReview(); }, [bankId]);

  const handleAction = async (qId: string, action: 'approve' | 'reject', comment?: string) => {
    const body: Record<string, string> = { action };
    if (comment) body.comment = comment;
    await fetch(`/api/question-banks/${bankId}/questions/${qId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    });
    await fetchReview();
    onReviewed();
  };

  const handleApproveAll = async () => {
    if (!confirm(`Duyệt tất cả ${questions.length} câu hỏi?`)) return;
    for (const q of questions) {
      await handleAction(q.id, 'approve');
    }
  };

  if (loading) return <div className="py-6 text-center text-sm text-muted-foreground">Đang tải...</div>;

  if (questions.length === 0) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        <p className="text-3xl mb-2">✓</p>
        <p className="text-sm">Không có câu hỏi nào chờ duyệt</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{questions.length} câu hỏi chờ duyệt</p>
        <button onClick={handleApproveAll}
          className="text-sm px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700">
          Duyệt tất cả
        </button>
      </div>

      <div className="divide-y border rounded-lg overflow-hidden">
        {questions.map((q) => (
          <div key={q.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex gap-2 mb-1">
                  {q.sourceDocId && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">AI</span>
                  )}
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">{q.difficulty}</span>
                </div>
                <p className="text-sm font-medium">{q.questionText}</p>

                {expanded === q.id && (
                  <div className="mt-2 space-y-1">
                    {q.options.map((o) => (
                      <div key={o.key} className={`text-xs flex gap-2 ${o.key === q.correctAnswer ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                        <span>{o.key}.</span><span>{o.text}</span>
                        {o.key === q.correctAnswer && <span>✓</span>}
                      </div>
                    ))}
                    {q.explanation && (
                      <p className="text-xs text-blue-600 mt-1">💡 {q.explanation}</p>
                    )}
                  </div>
                )}

                <button onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                  className="text-xs text-blue-500 hover:underline mt-1">
                  {expanded === q.id ? 'Thu gọn' : 'Xem đáp án'}
                </button>
              </div>

              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => handleAction(q.id, 'approve')}
                  className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">Duyệt</button>
                <button onClick={() => {
                  const comment = prompt('Lý do từ chối:');
                  if (comment) handleAction(q.id, 'reject', comment);
                }}
                  className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600">Từ chối</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
