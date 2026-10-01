import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  Plus,
  Search,
  Filter,
  Image as ImageIcon,
  Music,
  FileText,
  CheckCircle,
  Copy,
  Edit2,
  Trash2,
  Eye,
  FolderPlus,
  Folder,
  Layers,
  Clock,
  Award,
  Upload,
  X,
  AlertCircle,
  AlertTriangle,
  Check,
  Gamepad2,
  RefreshCw,
  Zap,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Download,
  Share2,
  FileJson,
  FileSpreadsheet,
  Link2,
  Play,
  RotateCcw,
} from 'lucide-react';
import { quizAdmin } from '../services/api';
import { useToast, useConfirm } from '../context/UiContext';
import { parseApiError } from '../utils/errors';
import { Card, EmptyState, PageState, Button } from '../components/ui';

export default function AdminQuiz() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();

  // Navigation hierarchy view: 'SETS' | 'DETAIL' | 'ALL_QUESTIONS'
  const [activeView, setActiveView] = useState('SETS');
  const [selectedSetId, setSelectedSetId] = useState(null);
  const [selectedSet, setSelectedSet] = useState(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [setDetailLoading, setSetDetailLoading] = useState(false);

  // Data
  const [quizSets, setQuizSets] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 1 });

  // Filters & Search
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals
  const [showSetModal, setShowSetModal] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportingSet, setExportingSet] = useState(null);
  const [showShareCodeModal, setShowShareCodeModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [zoomImage, setZoomImage] = useState(null);

  // Set Form
  const [setForm, setSetForm] = useState({
    title: '',
    description: '',
    category: 'Chung',
    imageUrl: '',
    status: 'PUBLISHED',
    isActive: true,
  });
  const [savingSet, setSavingSet] = useState(false);

  // Question Form
  const [qForm, setQForm] = useState({
    quizSetId: '',
    type: 'IMAGE',
    category: 'Chung',
    question: '',
    imageUrl: '',
    audioUrl: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctOption: 'A',
    explanation: '',
    timeLimit: 15,
    points: 1000,
    isActive: true,
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [savingQuestion, setSavingQuestion] = useState(false);

  // Import State
  const [importSourceType, setImportSourceType] = useState('JSON');
  const [importContent, setImportContent] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importParsing, setImportParsing] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState(null);
  const [importTargetSetId, setImportTargetSetId] = useState('');
  const [importTargetTitle, setImportTargetTitle] = useState('');
  const [importSaving, setImportSaving] = useState(false);

  // Share Code Quick Import
  const [shareCodeInput, setShareCodeInput] = useState('');
  const [fetchingShare, setFetchingShare] = useState(false);
  const [sharedQuizPreview, setSharedQuizPreview] = useState(null);

  // Realistic Player Preview State
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewSelectedOption, setPreviewSelectedOption] = useState(null);
  const [previewRevealed, setPreviewRevealed] = useState(false);
  const [previewTimer, setPreviewTimer] = useState(15);
  const [previewTimerActive, setPreviewTimerActive] = useState(false);

  // Refs
  const fileInputRef = useRef(null);
  const importFileInputRef = useRef(null);
  const questionInputRef = useRef(null);

  // ── FETCH DATA ──

  // Fetch Quiz Sets
  const fetchQuizSets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await quizAdmin.listQuizSets({
        search: search.trim() || undefined,
        status: filterStatus || undefined,
      });
      setQuizSets(data || []);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể tải danh sách bộ câu hỏi'));
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, toast]);

  // Fetch Questions for selected Quiz Set or Global Pool
  const fetchQuestions = useCallback(
    async (page = 1, targetSetId = null) => {
      try {
        setLoading(true);
        const params = {
          page,
          limit: 50,
          sortBy: 'orderIndex',
          order: 'ASC',
        };
        if (search.trim()) params.search = search.trim();
        if (targetSetId) {
          params.quizSetId = targetSetId;
        } else if (filterCategory) {
          params.category = filterCategory;
        }

        const res = await quizAdmin.listQuestions(params);
        setQuestions(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } catch (err) {
        toast.error(parseApiError(err, 'Không thể tải danh sách câu hỏi'));
      } finally {
        setLoading(false);
      }
    },
    [search, filterCategory, toast]
  );

  // Fetch Quiz Set Detail (with its questions)
  const fetchSetDetail = useCallback(
    async (setId) => {
      try {
        setSetDetailLoading(true);
        const data = await quizAdmin.getQuizSet(setId);
        setSelectedSet(data);
        setQuestions(data?.questions || []);
      } catch (err) {
        toast.error(parseApiError(err, 'Không thể tải thông tin bộ câu hỏi'));
        setActiveView('SETS');
      } finally {
        setSetDetailLoading(false);
      }
    },
    [toast]
  );

  // Initial load
  useEffect(() => {
    fetchQuizSets();
  }, [fetchQuizSets]);

  // Handle URL query for direct set opening
  useEffect(() => {
    const setIdFromUrl = searchParams.get('setId');
    if (setIdFromUrl) {
      setSelectedSetId(Number(setIdFromUrl));
      setActiveView('DETAIL');
      fetchSetDetail(Number(setIdFromUrl));
    }
  }, [searchParams, fetchSetDetail]);

  // ── VIEW SWITCHING ──

  const handleOpenSetDetail = (set) => {
    setSelectedSetId(set.id);
    setSelectedSet(set);
    setActiveView('DETAIL');
    setSearchParams({ setId: set.id });
    fetchSetDetail(set.id);
  };

  const handleBackToSets = () => {
    setActiveView('SETS');
    setSelectedSetId(null);
    setSelectedSet(null);
    setSearchParams({});
    fetchQuizSets();
  };

  // ── QUIZ SET CRUD ──

  const handleOpenCreateSet = () => {
    setEditingSet(null);
    setSetForm({
      title: '',
      description: '',
      category: 'Chung',
      imageUrl: '',
      status: 'PUBLISHED',
      isActive: true,
    });
    setShowSetModal(true);
  };

  const handleOpenEditSet = (set, e) => {
    if (e) e.stopPropagation();
    setEditingSet(set);
    setSetForm({
      title: set.title || '',
      description: set.description || '',
      category: set.category || 'Chung',
      imageUrl: set.imageUrl || '',
      status: set.status || 'PUBLISHED',
      isActive: set.isActive ?? true,
    });
    setShowSetModal(true);
  };

  const handleSaveSet = async () => {
    if (!setForm.title.trim()) {
      toast.error('Vui lòng nhập tên bộ câu hỏi');
      return;
    }

    try {
      setSavingSet(true);
      if (editingSet) {
        await quizAdmin.updateQuizSet(editingSet.id, setForm);
        toast.success('Cập nhật bộ câu hỏi thành công');
      } else {
        const res = await quizAdmin.createQuizSet(setForm);
        toast.success('Tạo bộ câu hỏi mới thành công');
        if (res.data?.id) {
          handleOpenSetDetail(res.data);
        }
      }
      setShowSetModal(false);
      fetchQuizSets();
      if (selectedSetId && editingSet && selectedSetId === editingSet.id) {
        fetchSetDetail(selectedSetId);
      }
    } catch (err) {
      toast.error(parseApiError(err, 'Lưu bộ câu hỏi thất bại'));
    } finally {
      setSavingSet(false);
    }
  };

  const handleDuplicateSet = async (set, e) => {
    if (e) e.stopPropagation();
    const isOk = await confirm({
      title: 'Nhân bản bộ câu hỏi',
      message: `Bạn có chắc muốn nhân bản bộ câu hỏi "${set.title}" cùng toàn bộ câu hỏi bên trong?`,
      confirmLabel: 'Nhân bản',
    });
    if (!isOk) return;

    try {
      await quizAdmin.duplicateQuizSet(set.id);
      toast.success('Đã nhân bản bộ câu hỏi thành công');
      fetchQuizSets();
    } catch (err) {
      toast.error(parseApiError(err, 'Nhân bản thất bại'));
    }
  };

  const handleDeleteSet = async (set, e) => {
    if (e) e.stopPropagation();
    const isOk = await confirm({
      title: 'Xác nhận xóa bộ câu hỏi',
      message: `Bạn có chắc chắn muốn xóa bộ câu hỏi "${set.title}"? Tất cả câu hỏi trong bộ này cũng sẽ bị xóa. Hành động này không thể hoàn tác.`,
      confirmLabel: 'Xóa vĩnh viễn',
      variant: 'danger',
    });
    if (!isOk) return;

    try {
      await quizAdmin.deleteQuizSet(set.id);
      toast.success('Đã xóa bộ câu hỏi thành công');
      if (selectedSetId === set.id) {
        handleBackToSets();
      } else {
        fetchQuizSets();
      }
    } catch (err) {
      toast.error(parseApiError(err, 'Xóa bộ câu hỏi thất bại'));
    }
  };

  // ── QUESTION CRUD ──

  const handleOpenAddQuestion = () => {
    setEditingQuestion(null);
    setQForm({
      quizSetId: selectedSetId ? String(selectedSetId) : '',
      type: 'IMAGE',
      category: selectedSet?.category || 'Chung',
      question: '',
      imageUrl: '',
      audioUrl: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctOption: 'A',
      explanation: '',
      timeLimit: 15,
      points: 1000,
      isActive: true,
    });
    setShowQuestionModal(true);
    setTimeout(() => questionInputRef.current?.focus(), 150);
  };

  const handleOpenEditQuestion = (item) => {
    setEditingQuestion(item);
    setQForm({
      quizSetId: item.quizSetId ? String(item.quizSetId) : (selectedSetId ? String(selectedSetId) : ''),
      type: item.type || 'IMAGE',
      category: item.category || 'Chung',
      question: item.question || '',
      imageUrl: item.imageUrl || '',
      audioUrl: item.audioUrl || '',
      optionA: item.optionA || '',
      optionB: item.optionB || '',
      optionC: item.optionC || '',
      optionD: item.optionD || '',
      correctOption: item.correctOption || 'A',
      explanation: item.explanation || '',
      timeLimit: item.timeLimit || 15,
      points: item.points || 1000,
      isActive: item.isActive ?? true,
    });
    setShowQuestionModal(true);
    setTimeout(() => questionInputRef.current?.focus(), 150);
  };

  // Direct Image Upload Handler
  const handleFileUpload = async (file) => {
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error('Chỉ chấp nhận các tệp ảnh: PNG, JPG, JPEG, WEBP, GIF, SVG');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Kích thước ảnh tối đa là 10MB');
      return;
    }

    try {
      setUploadingImage(true);
      setUploadProgress(10);
      const res = await quizAdmin.uploadImage(file, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percent);
      });

      if (res?.url) {
        setQForm((prev) => ({
          ...prev,
          imageUrl: res.url,
          type: prev.type === 'MUSIC' ? 'MUSIC' : 'IMAGE',
        }));
        toast.success('Tải ảnh lên thành công');
      }
    } catch (err) {
      toast.error(parseApiError(err, 'Tải ảnh lên thất bại'));
    } finally {
      setUploadingImage(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          handleFileUpload(blob);
          break;
        }
      }
    }
  };

  const handleSaveQuestion = async (isContinuous = false) => {
    if (!qForm.question.trim()) {
      toast.error('Vui lòng nhập nội dung câu hỏi');
      return;
    }
    if (!qForm.optionA.trim() || !qForm.optionB.trim() || !qForm.optionC.trim() || !qForm.optionD.trim()) {
      toast.error('Vui lòng nhập đầy đủ cả 4 phương án A, B, C, D');
      return;
    }

    try {
      setSavingQuestion(true);
      const payload = {
        ...qForm,
        quizSetId: qForm.quizSetId ? Number(qForm.quizSetId) : (selectedSetId || null),
        timeLimit: Number(qForm.timeLimit) || 15,
        points: Number(qForm.points) || 1000,
      };

      if (editingQuestion) {
        await quizAdmin.updateQuestion(editingQuestion.id, payload);
        toast.success('Cập nhật câu hỏi thành công');
        setShowQuestionModal(false);
      } else {
        await quizAdmin.createQuestion(payload);
        toast.success('Thêm câu hỏi mới thành công');
        if (isContinuous) {
          setQForm((prev) => ({
            ...prev,
            question: '',
            imageUrl: '',
            audioUrl: '',
            optionA: '',
            optionB: '',
            optionC: '',
            optionD: '',
            correctOption: 'A',
            explanation: '',
          }));
          questionInputRef.current?.focus();
        } else {
          setShowQuestionModal(false);
        }
      }

      if (selectedSetId) {
        fetchSetDetail(selectedSetId);
      } else {
        fetchQuestions();
      }
    } catch (err) {
      toast.error(parseApiError(err, 'Lưu câu hỏi thất bại'));
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleDuplicateQuestion = async (item) => {
    try {
      await quizAdmin.duplicateQuestion(item.id);
      toast.success('Đã nhân bản câu hỏi thành công');
      if (selectedSetId) {
        fetchSetDetail(selectedSetId);
      } else {
        fetchQuestions();
      }
    } catch (err) {
      toast.error(parseApiError(err, 'Nhân bản câu hỏi thất bại'));
    }
  };

  const handleDeleteQuestion = async (item) => {
    const isOk = await confirm({
      title: 'Xóa câu hỏi',
      message: 'Bạn có chắc chắn muốn xóa câu hỏi này khỏi hệ thống?',
      confirmLabel: 'Xóa',
      variant: 'danger',
    });
    if (!isOk) return;

    try {
      await quizAdmin.deleteQuestion(item.id);
      toast.success('Đã xóa câu hỏi thành công');
      if (selectedSetId) {
        fetchSetDetail(selectedSetId);
      } else {
        fetchQuestions();
      }
    } catch (err) {
      toast.error(parseApiError(err, 'Xóa câu hỏi thất bại'));
    }
  };

  // Reorder Questions (Move Up / Move Down)
  const handleMoveQuestion = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const newQuestions = [...questions];
    const temp = newQuestions[index];
    newQuestions[index] = newQuestions[targetIndex];
    newQuestions[targetIndex] = temp;

    setQuestions(newQuestions);

    try {
      const questionIds = newQuestions.map((q) => q.id);
      await quizAdmin.reorderQuestions(questionIds);
      toast.success('Đã cập nhật thứ tự câu hỏi');
    } catch (err) {
      toast.error(parseApiError(err, 'Cập nhật thứ tự thất bại'));
      if (selectedSetId) fetchSetDetail(selectedSetId);
    }
  };

  // ── IMPORT WORKFLOW ──

  const handleOpenImport = (presetSetId = null) => {
    setImportSourceType('JSON');
    setImportContent('');
    setImportFileName('');
    setImportPreviewData(null);
    setImportTargetSetId(presetSetId ? String(presetSetId) : (selectedSetId ? String(selectedSetId) : 'NEW'));
    setImportTargetTitle(selectedSet ? selectedSet.title : 'Bộ câu hỏi Import mới');
    setShowImportModal(true);
  };

  const handleImportFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'json') setImportSourceType('JSON');
    else if (ext === 'csv') setImportSourceType('CSV');

    const reader = new FileReader();
    reader.onload = (event) => {
      setImportContent(event.target.result || '');
    };
    reader.readAsText(file);
  };

  const handleValidateImport = async () => {
    if (!importContent.trim()) {
      toast.error('Vui lòng chọn tệp hoặc dán nội dung câu hỏi để import');
      return;
    }

    try {
      setImportParsing(true);
      const res = await quizAdmin.validateImport({
        sourceType: importSourceType,
        content: importContent,
      });

      setImportPreviewData(res);
      if (res.title && (!importTargetTitle || importTargetTitle === 'Bộ câu hỏi Import mới')) {
        setImportTargetTitle(res.title);
      }
      toast.success(`Đã phân tích ${res.total} câu hỏi (${res.validCount} hợp lệ, ${res.errorCount} lỗi)`);
    } catch (err) {
      toast.error(parseApiError(err, 'Phân tích dữ liệu import thất bại'));
    } finally {
      setImportParsing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreviewData || !importPreviewData.items) return;

    const validQuestions = importPreviewData.items
      .filter((item) => item.isValid)
      .map((item) => item.data);

    if (validQuestions.length === 0) {
      toast.error('Không có câu hỏi hợp lệ nào để import');
      return;
    }

    try {
      setImportSaving(true);
      const targetId = importTargetSetId === 'NEW' ? null : Number(importTargetSetId);

      const res = await quizAdmin.confirmImport({
        title: importTargetTitle.trim() || 'Bộ câu hỏi Import',
        targetQuizSetId: targetId,
        questions: validQuestions,
      });

      toast.success(res.message || 'Import thành công');
      setShowImportModal(false);
      fetchQuizSets();

      if (res.data?.quizSet?.id) {
        handleOpenSetDetail(res.data.quizSet);
      } else if (selectedSetId) {
        fetchSetDetail(selectedSetId);
      }
    } catch (err) {
      toast.error(parseApiError(err, 'Lưu import thất bại'));
    } finally {
      setImportSaving(false);
    }
  };

  // ── SHARE & EXPORT WORKFLOW ──

  const handleOpenExport = (set, e) => {
    if (e) e.stopPropagation();
    setExportingSet(set);
    setShowExportModal(true);
  };

  const handleFetchSharedQuiz = async () => {
    if (!shareCodeInput.trim()) {
      toast.error('Vui lòng nhập mã chia sẻ');
      return;
    }

    try {
      setFetchingShare(true);
      const data = await quizAdmin.getSharedQuizSet(shareCodeInput.trim());
      setSharedQuizPreview(data);
      toast.success(`Đã tìm thấy: "${data.title}" (${data.questionCount} câu hỏi)`);
    } catch (err) {
      toast.error(parseApiError(err, 'Không tìm thấy bộ câu hỏi với mã này'));
      setSharedQuizPreview(null);
    } finally {
      setFetchingShare(false);
    }
  };

  const handleImportFromShareCode = async () => {
    if (!sharedQuizPreview) return;

    try {
      setImportSaving(true);
      const res = await quizAdmin.confirmImport({
        title: `${sharedQuizPreview.title} (Từ mã ${sharedQuizPreview.shareCode})`,
        description: sharedQuizPreview.description,
        category: sharedQuizPreview.category,
        questions: (sharedQuizPreview.questions || []).map((q) => ({
          question: q.question,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctOption: q.correctOption,
          timeLimit: q.timeLimit,
          points: q.points,
          imageUrl: q.imageUrl,
          audioUrl: q.audioUrl,
          explanation: q.explanation,
        })),
      });

      toast.success('Đã import bộ câu hỏi thành công');
      setShowShareCodeModal(false);
      setSharedQuizPreview(null);
      setShareCodeInput('');
      fetchQuizSets();

      if (res.data?.quizSet?.id) {
        handleOpenSetDetail(res.data.quizSet);
      }
    } catch (err) {
      toast.error(parseApiError(err, 'Import từ mã chia sẻ thất bại'));
    } finally {
      setImportSaving(false);
    }
  };

  // ── REALISTIC PLAYER PREVIEW WORKFLOW ──

  const handleStartPlayerPreview = (startIndex = 0) => {
    if (questions.length === 0) {
      toast.error('Chưa có câu hỏi nào để xem trước');
      return;
    }
    setPreviewIndex(startIndex);
    setPreviewSelectedOption(null);
    setPreviewRevealed(false);
    setPreviewTimer(questions[startIndex]?.timeLimit || 15);
    setPreviewTimerActive(true);
    setShowPreviewModal(true);
  };

  // Preview timer tick
  useEffect(() => {
    let interval = null;
    if (showPreviewModal && previewTimerActive && !previewRevealed) {
      interval = setInterval(() => {
        setPreviewTimer((prev) => {
          if (prev <= 1) {
            setPreviewRevealed(true);
            setPreviewTimerActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showPreviewModal, previewTimerActive, previewRevealed]);

  const handlePreviewAnswer = (optionKey) => {
    if (previewRevealed) return;
    setPreviewSelectedOption(optionKey);
    setPreviewRevealed(true);
    setPreviewTimerActive(false);
  };

  const handleNextPreviewQuestion = () => {
    const nextIdx = previewIndex + 1;
    if (nextIdx < questions.length) {
      setPreviewIndex(nextIdx);
      setPreviewSelectedOption(null);
      setPreviewRevealed(false);
      setPreviewTimer(questions[nextIdx]?.timeLimit || 15);
      setPreviewTimerActive(true);
    } else {
      toast.success('Bạn đã xem hết tất cả câu hỏi trong Quiz');
      setShowPreviewModal(false);
    }
  };

  const copyToClipboard = (text, label = 'mã chia sẻ') => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label} vào clipboard`);
  };

  // ── RENDER ──

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-4 sm:p-6 lg:p-8" onPaste={handlePaste}>
      {/* ── TOP HEADER / BREADCRUMB ── */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-amber-400/90 uppercase mb-1">
              <span>ADMIN</span>
              <ChevronRight className="w-3.5 h-3.5 text-white/30" />
              <span>TRÒ CHƠI</span>
              <ChevronRight className="w-3.5 h-3.5 text-white/30" />
              <span className="text-white">QUIZ</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <Zap className="w-7 h-7 text-amber-400" />
              Quản Lý Câu Hỏi & Quiz
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {activeView === 'DETAIL' ? (
              <>
                <Button variant="ghost" onClick={handleBackToSets} className="border border-white/10">
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  Danh sách Quiz
                </Button>
                <Button variant="secondary" onClick={() => handleStartPlayerPreview(0)} className="bg-white/10">
                  <Eye className="w-4 h-4 mr-1.5 text-blue-400" />
                  Xem trước người chơi
                </Button>
                <Button variant="secondary" onClick={() => handleOpenImport(selectedSetId)}>
                  <Upload className="w-4 h-4 mr-1.5 text-emerald-400" />
                  Import vào Quiz
                </Button>
                <Button variant="primary" onClick={handleOpenAddQuestion} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Thêm câu hỏi
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setShowShareCodeModal(true)} className="border border-white/10">
                  <Link2 className="w-4 h-4 mr-1.5 text-amber-400" />
                  Nhập mã Share
                </Button>
                <Button variant="secondary" onClick={() => handleOpenImport(null)}>
                  <Upload className="w-4 h-4 mr-1.5 text-emerald-400" />
                  Import Quiz
                </Button>
                <Button variant="primary" onClick={handleOpenCreateSet} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Tạo Quiz Mới
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── STATS BAR (WHEN IN SETS VIEW) ── */}
        {activeView === 'SETS' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <Card className="p-4 bg-white/[0.03] border-white/10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider font-semibold">Tổng Bộ Quiz</div>
                <div className="text-2xl font-bold text-white mt-0.5">{quizSets.length}</div>
              </div>
            </Card>
            <Card className="p-4 bg-white/[0.03] border-white/10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider font-semibold">Tổng Câu Hỏi Đã Tạo</div>
                <div className="text-2xl font-bold text-white mt-0.5">
                  {quizSets.reduce((acc, s) => acc + (s.questionCount || 0), 0)}
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-white/[0.03] border-white/10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider font-semibold">Quiz Đang Kích Hoạt</div>
                <div className="text-2xl font-bold text-white mt-0.5">
                  {quizSets.filter((s) => s.isActive && s.status === 'PUBLISHED').length}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          VIEW 1: DANH SÁCH BỘ QUIZ (QUIZ SETS LIST)
         ══════════════════════════════════════════════════════════════════ */}
      {activeView === 'SETS' && (
        <div className="max-w-7xl mx-auto">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm kiếm Quiz..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
              />
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-amber-400"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="PUBLISHED">Đã xuất bản (Published)</option>
                <option value="DRAFT">Bản nháp (Draft)</option>
                <option value="ARCHIVED">Lưu trữ (Archived)</option>
              </select>
              <Button variant="ghost" onClick={fetchQuizSets} className="p-2 border border-white/10">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Sets Table / Grid */}
          {loading ? (
            <div className="py-20 text-center text-white/50 flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
              <span>Đang tải danh sách Quiz...</span>
            </div>
          ) : quizSets.length === 0 ? (
            <Card className="py-16 text-center bg-white/[0.02] border-white/10">
              <div className="max-w-md mx-auto flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
                  <Layers className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">Chưa có Quiz nào</h3>
                <p className="text-sm text-white/50 mb-6">
                  Tạo Quiz mới hoặc Import bộ câu hỏi từ file JSON/CSV để bắt đầu.
                </p>
                <div className="flex gap-3">
                  <Button variant="primary" onClick={handleOpenCreateSet} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Tạo Quiz Mới
                  </Button>
                  <Button variant="secondary" onClick={() => handleOpenImport(null)}>
                    <Upload className="w-4 h-4 mr-1.5" />
                    Import Quiz
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {quizSets.map((set) => (
                <Card
                  key={set.id}
                  className="bg-white/[0.03] border-white/10 hover:border-amber-500/40 transition-all p-5 flex flex-col justify-between group cursor-pointer"
                  onClick={() => handleOpenSetDetail(set)}
                >
                  <div>
                    {/* Category & Status */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white/80 border border-white/10">
                        {set.category || 'Chung'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {set.status === 'PUBLISHED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            PUBLISHED
                          </span>
                        ) : set.status === 'DRAFT' ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            DRAFT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-white/50 border border-white/10">
                            ARCHIVED
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-1 mb-1.5">
                      {set.title}
                    </h3>
                    <p className="text-xs text-white/50 line-clamp-2 mb-4 min-h-[32px]">
                      {set.description || 'Chưa có mô tả cho bộ câu hỏi này.'}
                    </p>

                    {/* Stats & Share code */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs text-white/60">
                      <span className="flex items-center gap-1 font-semibold text-white">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                        {set.questionCount || 0} câu hỏi
                      </span>
                      {set.shareCode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(set.shareCode, 'mã chia sẻ');
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-amber-300 font-mono"
                          title="Click để copy mã chia sẻ"
                        >
                          <Share2 className="w-3 h-3" />
                          {set.shareCode}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between gap-1.5 pt-4 mt-4 border-t border-white/10">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSetDetail(set);
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs flex-1"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Mở câu hỏi
                    </Button>
                    <button
                      onClick={(e) => handleOpenExport(set, e)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10"
                      title="Share / Export"
                    >
                      <Share2 className="w-4 h-4 text-blue-400" />
                    </button>
                    <button
                      onClick={(e) => handleDuplicateSet(set, e)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10"
                      title="Nhân bản bộ Quiz"
                    >
                      <Copy className="w-4 h-4 text-emerald-400" />
                    </button>
                    <button
                      onClick={(e) => handleOpenEditSet(set, e)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10"
                      title="Chỉnh sửa thông tin"
                    >
                      <Edit2 className="w-4 h-4 text-amber-400" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteSet(set, e)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/70 hover:text-red-400 border border-white/10"
                      title="Xóa bộ Quiz"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          VIEW 2: QUIZ DETAIL / QUESTION MANAGER
         ══════════════════════════════════════════════════════════════════ */}
      {activeView === 'DETAIL' && selectedSet && (
        <div className="max-w-7xl mx-auto">
          {/* Detail Subheader Bar */}
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {selectedSet.category || 'Chung'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {selectedSet.status || 'PUBLISHED'}
                  </span>
                  {selectedSet.shareCode && (
                    <button
                      onClick={() => copyToClipboard(selectedSet.shareCode, 'mã chia sẻ')}
                      className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-mono text-amber-300 border border-white/10"
                    >
                      <Share2 className="w-3 h-3" />
                      Mã: {selectedSet.shareCode}
                    </button>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">{selectedSet.title}</h2>
                <p className="text-sm text-white/60">
                  {selectedSet.description || 'Quản lý thứ tự và danh sách câu hỏi trong bộ Quiz.'}
                </p>
              </div>

              <div className="flex items-center gap-4 text-sm font-semibold text-white/80 bg-white/5 px-4 py-2.5 rounded-lg border border-white/10">
                <span>Tổng: <strong className="text-amber-400 text-base">{questions.length}</strong> câu hỏi</span>
              </div>
            </div>
          </div>

          {/* Question List Header / Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              Danh Sách Câu Hỏi ({questions.length})
            </h3>
            <span className="text-xs text-white/40">
              * Dùng nút mũi tên lên/xuống để thay đổi thứ tự câu hỏi chính thức
            </span>
          </div>

          {/* Questions List */}
          {setDetailLoading ? (
            <div className="py-20 text-center text-white/50 flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
              <span>Đang tải danh sách câu hỏi...</span>
            </div>
          ) : questions.length === 0 ? (
            <Card className="py-16 text-center bg-white/[0.02] border-white/10">
              <div className="max-w-md mx-auto flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
                  <HelpCircle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">Bộ Quiz này chưa có câu hỏi nào</h3>
                <p className="text-sm text-white/50 mb-6">
                  Thêm câu hỏi mới với hình ảnh và 4 phương án hoặc Import từ file JSON/CSV.
                </p>
                <div className="flex gap-3">
                  <Button variant="primary" onClick={handleOpenAddQuestion} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Thêm câu hỏi đầu tiên
                  </Button>
                  <Button variant="secondary" onClick={() => handleOpenImport(selectedSetId)}>
                    <Upload className="w-4 h-4 mr-1.5" />
                    Import vào Quiz này
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <div className="space-y-3.5">
              {questions.map((q, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === questions.length - 1;

                return (
                  <Card
                    key={q.id}
                    className="bg-white/[0.03] border-white/10 hover:border-white/20 transition-all p-4.5 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    {/* Left: Reorder & Number & Details */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Reorder Buttons */}
                      <div className="flex flex-col items-center gap-1 pt-0.5">
                        <button
                          disabled={isFirst}
                          onClick={() => handleMoveQuestion(idx, -1)}
                          className={`p-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 ${
                            isFirst ? 'opacity-30 cursor-not-allowed' : 'text-white/70 hover:text-white'
                          }`}
                          title="Di chuyển lên"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-mono font-bold text-amber-400">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <button
                          disabled={isLast}
                          onClick={() => handleMoveQuestion(idx, 1)}
                          className={`p-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 ${
                            isLast ? 'opacity-30 cursor-not-allowed' : 'text-white/70 hover:text-white'
                          }`}
                          title="Di chuyển xuống"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Image Thumbnail if available */}
                      {q.imageUrl && (
                        <div
                          onClick={() => setZoomImage(q.imageUrl)}
                          className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/15 shrink-0 bg-black/40 cursor-pointer group/img"
                        >
                          <img src={q.imageUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      )}

                      {/* Question Text & Options */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white/10 text-white/70">
                            {q.category || 'Chung'}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] font-medium text-white/50">
                            <Clock className="w-3 h-3 text-amber-400" />
                            {q.timeLimit || 15}s
                          </span>
                          <span className="flex items-center gap-1 text-[11px] font-medium text-white/50">
                            <Award className="w-3 h-3 text-emerald-400" />
                            {q.points || 1000} pts
                          </span>
                        </div>

                        <h4 className="text-base font-semibold text-white mb-2 leading-snug line-clamp-2">
                          {q.question}
                        </h4>

                        {/* 4 Options Pill Preview */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {['A', 'B', 'C', 'D'].map((optKey) => {
                            const optText = q[`option${optKey}`];
                            const isCorrect = q.correctOption === optKey;
                            return (
                              <div
                                key={optKey}
                                className={`px-2.5 py-1.5 rounded-lg flex items-center gap-2 border ${
                                  isCorrect
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-semibold'
                                    : 'bg-white/[0.02] border-white/10 text-white/70'
                                }`}
                              >
                                <span
                                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                                    isCorrect ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/70'
                                  }`}
                                >
                                  {optKey}
                                </span>
                                <span className="truncate">{optText}</span>
                                {isCorrect && <Check className="w-3.5 h-3.5 ml-auto text-emerald-400 shrink-0" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <button
                        onClick={() => handleStartPlayerPreview(idx)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10"
                        title="Xem trước câu hỏi này"
                      >
                        <Eye className="w-4 h-4 text-blue-400" />
                      </button>
                      <button
                        onClick={() => handleDuplicateQuestion(q)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10"
                        title="Nhân bản câu hỏi"
                      >
                        <Copy className="w-4 h-4 text-emerald-400" />
                      </button>
                      <button
                        onClick={() => handleOpenEditQuestion(q)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10"
                        title="Chỉnh sửa câu hỏi"
                      >
                        <Edit2 className="w-4 h-4 text-amber-400" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/70 hover:text-red-400 border border-white/10"
                        title="Xóa câu hỏi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 1: QUESTION EDITOR (ADD / EDIT QUESTION)
         ══════════════════════════════════════════════════════════════════ */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#161b22] border border-white/15 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                {editingQuestion ? 'Chỉnh Sửa Câu Hỏi' : 'Thêm Câu Hỏi Mới'}
              </h3>
              <button
                onClick={() => setShowQuestionModal(false)}
                className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Question Text */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5">
                  Nội dung câu hỏi <span className="text-amber-400">*</span>
                </label>
                <textarea
                  ref={questionInputRef}
                  rows={3}
                  value={qForm.question}
                  onChange={(e) => setQForm({ ...qForm, question: e.target.value })}
                  placeholder="Nhập nội dung câu hỏi..."
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/15 rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:border-amber-400 resize-none font-medium"
                />
              </div>

              {/* Image Upload Zone */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5">
                  Hình ảnh câu hỏi (Tùy chọn)
                </label>
                {qForm.imageUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-white/20 bg-black/40 p-2 flex items-center gap-4">
                    <img
                      src={qForm.imageUrl}
                      alt="Question Preview"
                      className="w-24 h-24 object-cover rounded-lg border border-white/10 cursor-pointer"
                      onClick={() => setZoomImage(qForm.imageUrl)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white/70 truncate font-mono mb-2">{qForm.imageUrl}</div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="border border-white/15 text-xs py-1"
                        >
                          Thay ảnh khác
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setQForm({ ...qForm, imageUrl: '' })}
                          className="border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs py-1"
                        >
                          Xóa ảnh
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/15 hover:border-amber-400/60 rounded-xl p-5 text-center cursor-pointer bg-white/[0.02] hover:bg-white/[0.04] transition-all"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                      className="hidden"
                    />
                    {uploadingImage ? (
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                        <span className="text-xs text-white/70">Đang tải ảnh lên ({uploadProgress}%)...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <ImageIcon className="w-8 h-8 text-white/40 mb-1" />
                        <span className="text-sm font-semibold text-white">Kéo thả ảnh vào đây hoặc Click để chọn</span>
                        <span className="text-xs text-white/40">Hỗ trợ PNG, JPG, JPEG, WEBP (hoặc Ctrl+V để dán trực tiếp)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 4 Options with Radio Select for Correct Answer */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">
                  4 Phương án trả lời & Chọn đáp án đúng <span className="text-amber-400">*</span>
                </label>
                <div className="space-y-2.5">
                  {['A', 'B', 'C', 'D'].map((optKey) => {
                    const isSelected = qForm.correctOption === optKey;
                    return (
                      <div
                        key={optKey}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/40'
                            : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setQForm({ ...qForm, correctOption: optKey })}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 transition-all ${
                            isSelected
                              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30'
                              : 'bg-white/10 text-white/70 hover:bg-white/20'
                          }`}
                          title="Click để đặt làm đáp án đúng"
                        >
                          {optKey}
                        </button>
                        <input
                          type="text"
                          value={qForm[`option${optKey}`]}
                          onChange={(e) => setQForm({ ...qForm, [`option${optKey}`]: e.target.value })}
                          placeholder={`Nội dung phương án ${optKey}...`}
                          className="flex-1 bg-transparent border-none text-sm text-white placeholder-white/30 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setQForm({ ...qForm, correctOption: optKey })}
                          className={`px-3 py-1 rounded-md text-xs font-semibold shrink-0 transition-all ${
                            isSelected
                              ? 'bg-emerald-500 text-black font-bold'
                              : 'bg-white/5 text-white/40 hover:text-white/80'
                          }`}
                        >
                          {isSelected ? '✓ ĐÚNG' : 'Chọn đúng'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Timer, Points, Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1">
                    Thời gian
                  </label>
                  <select
                    value={qForm.timeLimit}
                    onChange={(e) => setQForm({ ...qForm, timeLimit: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value={10}>10 giây</option>
                    <option value={15}>15 giây</option>
                    <option value={20}>20 giây</option>
                    <option value={30}>30 giây</option>
                    <option value={45}>45 giây</option>
                    <option value={60}>60 giây</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1">
                    Điểm số
                  </label>
                  <select
                    value={qForm.points}
                    onChange={(e) => setQForm({ ...qForm, points: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value={500}>500 điểm</option>
                    <option value={1000}>1,000 điểm</option>
                    <option value={1500}>1,500 điểm</option>
                    <option value={2000}>2,000 điểm</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1">
                    Chủ đề
                  </label>
                  <input
                    type="text"
                    value={qForm.category}
                    onChange={(e) => setQForm({ ...qForm, category: e.target.value })}
                    placeholder="Chung, Lịch sử, IT..."
                    className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Explanation (Optional) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1">
                  Giải thích đáp án (Tùy chọn)
                </label>
                <textarea
                  rows={2}
                  value={qForm.explanation}
                  onChange={(e) => setQForm({ ...qForm, explanation: e.target.value })}
                  placeholder="Giải thích thêm khi người chơi trả lời xong..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3 bg-white/[0.02]">
              <Button variant="ghost" onClick={() => setShowQuestionModal(false)}>
                Hủy
              </Button>
              {!editingQuestion && (
                <Button
                  variant="secondary"
                  disabled={savingQuestion}
                  onClick={() => handleSaveQuestion(true)}
                  className="bg-white/10 hover:bg-white/20"
                >
                  Lưu & Tạo câu tiếp
                </Button>
              )}
              <Button
                variant="primary"
                disabled={savingQuestion}
                onClick={() => handleSaveQuestion(false)}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              >
                {savingQuestion ? 'Đang lưu...' : 'Lưu Câu Hỏi'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 2: CREATE / EDIT QUIZ SET
         ══════════════════════════════════════════════════════════════════ */}
      {showSetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#161b22] border border-white/15 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-amber-400" />
                {editingSet ? 'Chỉnh Sửa Bộ Quiz' : 'Tạo Bộ Quiz Mới'}
              </h3>
              <button onClick={() => setShowSetModal(false)} className="text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5">
                  Tên bộ câu hỏi <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={setForm.title}
                  onChange={(e) => setSetForm({ ...setForm, title: e.target.value })}
                  placeholder="Ví dụ: Đố Vui Công Nghệ 2026..."
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5">
                  Mô tả
                </label>
                <textarea
                  rows={2}
                  value={setForm.description}
                  onChange={(e) => setSetForm({ ...setForm, description: e.target.value })}
                  placeholder="Mô tả ngắn về chủ đề bộ câu hỏi..."
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5">
                    Chủ đề
                  </label>
                  <input
                    type="text"
                    value={setForm.category}
                    onChange={(e) => setSetForm({ ...setForm, category: e.target.value })}
                    placeholder="Chung, IT, Văn hóa..."
                    className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5">
                    Trạng thái
                  </label>
                  <select
                    value={setForm.status}
                    onChange={(e) => setSetForm({ ...setForm, status: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="PUBLISHED">Đã xuất bản (Published)</option>
                    <option value="DRAFT">Bản nháp (Draft)</option>
                    <option value="ARCHIVED">Lưu trữ (Archived)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3 bg-white/[0.02]">
              <Button variant="ghost" onClick={() => setShowSetModal(false)}>
                Hủy
              </Button>
              <Button
                variant="primary"
                disabled={savingSet}
                onClick={handleSaveSet}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              >
                {savingSet ? 'Đang lưu...' : 'Lưu Bộ Quiz'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 3: IMPORT QUIZ WITH REVIEW PIPELINE
         ══════════════════════════════════════════════════════════════════ */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#161b22] border border-white/15 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                Import Bộ Câu Hỏi & Rà Soát Dữ Liệu
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Import Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {!importPreviewData ? (
                <>
                  {/* Step 1: Input source */}
                  <div className="flex gap-2 border-b border-white/10 pb-3">
                    {['JSON', 'CSV', 'TEXT'].map((type) => (
                      <button
                        key={type}
                        onClick={() => setImportSourceType(type)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                          importSourceType === type
                            ? 'bg-amber-500 text-black'
                            : 'bg-white/5 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {type === 'JSON' ? 'Tệp JSON' : type === 'CSV' ? 'Tệp CSV / Excel' : 'Dán Văn Bản'}
                      </button>
                    ))}
                  </div>

                  {/* Target Quiz selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1">
                        Đích lưu trữ
                      </label>
                      <select
                        value={importTargetSetId}
                        onChange={(e) => setImportTargetSetId(e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm text-white focus:outline-none focus:border-amber-400"
                      >
                        <option value="NEW">+ Tạo bộ Quiz mới</option>
                        {quizSets.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title} ({s.questionCount || 0} câu)
                          </option>
                        ))}
                      </select>
                    </div>

                    {importTargetSetId === 'NEW' && (
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1">
                          Tên bộ Quiz mới
                        </label>
                        <input
                          type="text"
                          value={importTargetTitle}
                          onChange={(e) => setImportTargetTitle(e.target.value)}
                          placeholder="Nhập tên Quiz mới..."
                          className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    )}
                  </div>

                  {/* File Upload Zone */}
                  {(importSourceType === 'JSON' || importSourceType === 'CSV') && (
                    <div>
                      <input
                        ref={importFileInputRef}
                        type="file"
                        accept={importSourceType === 'JSON' ? '.json' : '.csv,.txt'}
                        onChange={handleImportFileSelect}
                        className="hidden"
                      />
                      <div
                        onClick={() => importFileInputRef.current?.click()}
                        className="border-2 border-dashed border-white/15 hover:border-emerald-400/60 rounded-xl p-6 text-center cursor-pointer bg-white/[0.02] hover:bg-white/[0.04]"
                      >
                        <FileSpreadsheet className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                        <span className="text-sm font-semibold text-white block">
                          {importFileName ? `Đã chọn: ${importFileName}` : `Click để tải lên tệp .${importSourceType.toLowerCase()}`}
                        </span>
                        <span className="text-xs text-white/40 block mt-1">
                          {importSourceType === 'JSON' ? 'Hỗ trợ định dạng WorkRank JSON chuẩn hoặc mảng câu hỏi' : 'Cột: Question, Option A, Option B, Option C, Option D, Correct Option'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Raw Text Input */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1">
                      Hoặc dán nội dung dữ liệu ({importSourceType})
                    </label>
                    <textarea
                      rows={6}
                      value={importContent}
                      onChange={(e) => setImportContent(e.target.value)}
                      placeholder={
                        importSourceType === 'JSON'
                          ? '{"questions": [{"question": "...", "optionA": "...", "correctOption": "A"}]}'
                          : importSourceType === 'CSV'
                          ? 'Question,Option A,Option B,Option C,Option D,Correct Option\nThủ đô Việt Nam?,Hà Nội,Huế,Đà Nẵng,TP.HCM,A'
                          : '1. Thủ đô Việt Nam là gì?\nA. Hà Nội\nB. Đà Nẵng\nC. TP.HCM\nD. Cần Thơ\nĐáp án: A'
                      }
                      className="w-full px-3.5 py-2.5 bg-white/5 border border-white/15 rounded-xl text-xs text-white font-mono placeholder-white/30 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Step 2: Review & Validation Summary */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h4 className="text-base font-bold text-white">{importPreviewData.title}</h4>
                      <p className="text-xs text-white/50">{importPreviewData.description || 'Kết quả phân tích dữ liệu import'}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-semibold">
                      <span className="px-3 py-1.5 rounded-lg bg-white/10 text-white">
                        Tổng: {importPreviewData.total}
                      </span>
                      <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Hợp lệ: {importPreviewData.validCount}
                      </span>
                      {importPreviewData.errorCount > 0 && (
                        <span className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
                          Lỗi: {importPreviewData.errorCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Review Table */}
                  <div className="border border-white/10 rounded-xl overflow-hidden">
                    <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                      {importPreviewData.items.map((item, i) => (
                        <div key={i} className="p-3.5 bg-white/[0.02] hover:bg-white/[0.04] text-xs">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="font-mono font-bold text-white/60">#{item.index}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.status === 'VALID'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : item.status === 'WARNING'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-red-500/20 text-red-400'
                              }`}
                            >
                              {item.status}
                            </span>
                          </div>

                          <div className="font-semibold text-white mb-2">{item.data?.question || '(Thiếu nội dung câu hỏi)'}</div>

                          <div className="grid grid-cols-2 gap-2 text-white/70 mb-2">
                            {['A', 'B', 'C', 'D'].map((k) => (
                              <div
                                key={k}
                                className={`px-2 py-1 rounded truncate ${
                                  item.data?.correctOption === k ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'bg-white/5'
                                }`}
                              >
                                {k}. {item.data?.[`option${k}`] || '---'}
                              </div>
                            ))}
                          </div>

                          {item.errors?.length > 0 && (
                            <div className="text-red-400 text-[11px] flex items-center gap-1 mt-1">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              {item.errors.join('; ')}
                            </div>
                          )}
                          {item.warnings?.length > 0 && (
                            <div className="text-amber-400 text-[11px] flex items-center gap-1 mt-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              {item.warnings.join('; ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between bg-white/[0.02]">
              {importPreviewData ? (
                <Button variant="ghost" onClick={() => setImportPreviewData(null)}>
                  Quay lại sửa dữ liệu
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => setShowImportModal(false)}>
                  Hủy
                </Button>
              )}

              {importPreviewData ? (
                <Button
                  variant="primary"
                  disabled={importSaving || importPreviewData.validCount === 0}
                  onClick={handleConfirmImport}
                  className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
                >
                  {importSaving ? 'Đang lưu...' : `Xác nhận Import ${importPreviewData.validCount} câu hợp lệ`}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  disabled={importParsing}
                  onClick={handleValidateImport}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                >
                  {importParsing ? 'Đang phân tích...' : 'Phân tích & Xem trước'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 4: EXPORT & SHARE QUIZ
         ══════════════════════════════════════════════════════════════════ */}
      {showExportModal && exportingSet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#161b22] border border-white/15 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-blue-400" />
                Share & Export Quiz
              </h3>
              <button onClick={() => setShowExportModal(false)} className="text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-base font-bold text-white">{exportingSet.title}</h4>
                <p className="text-xs text-white/50">{exportingSet.description || 'Xuất bộ câu hỏi ra các định dạng chuẩn'}</p>
              </div>

              {/* Share Code Box */}
              {exportingSet.shareCode && (
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-white/50 uppercase font-semibold">Mã chia sẻ nội bộ</div>
                    <div className="text-lg font-mono font-bold text-amber-400 tracking-wider">
                      {exportingSet.shareCode}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => copyToClipboard(exportingSet.shareCode, 'mã chia sẻ')}
                    className="bg-white/10"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copy
                  </Button>
                </div>
              )}

              {/* Download Buttons */}
              <div className="space-y-2 pt-2">
                <a
                  href={quizAdmin.exportQuizSetUrl(exportingSet.id, 'json')}
                  download
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-semibold text-white transition-colors"
                >
                  <FileJson className="w-4 h-4 text-amber-400" />
                  Tải tệp JSON (WorkRank Format)
                </a>
                <a
                  href={quizAdmin.exportQuizSetUrl(exportingSet.id, 'csv')}
                  download
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-semibold text-white transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  Tải tệp CSV (Bảng tính Excel)
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 5: IMPORT FROM SHARE CODE
         ══════════════════════════════════════════════════════════════════ */}
      {showShareCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#161b22] border border-white/15 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Link2 className="w-5 h-5 text-amber-400" />
                Nhập Mã Share Quiz
              </h3>
              <button onClick={() => setShowShareCodeModal(false)} className="text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5">
                  Mã chia sẻ (Ví dụ: WR9A2F8B)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareCodeInput}
                    onChange={(e) => setShareCodeInput(e.target.value.toUpperCase())}
                    placeholder="WRXXXXXX"
                    className="flex-1 px-3.5 py-2.5 bg-white/5 border border-white/15 rounded-xl font-mono text-sm text-amber-300 font-bold focus:outline-none focus:border-amber-400 uppercase"
                  />
                  <Button
                    variant="secondary"
                    disabled={fetchingShare || !shareCodeInput.trim()}
                    onClick={handleFetchSharedQuiz}
                  >
                    {fetchingShare ? 'Tìm...' : 'Kiểm tra'}
                  </Button>
                </div>
              </div>

              {/* Shared Quiz Preview */}
              {sharedQuizPreview && (
                <div className="p-4 rounded-xl bg-white/5 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-400 font-semibold">Tìm thấy bộ câu hỏi</span>
                    <span className="text-xs text-white/50">{sharedQuizPreview.questionCount} câu hỏi</span>
                  </div>
                  <h4 className="text-base font-bold text-white">{sharedQuizPreview.title}</h4>
                  <p className="text-xs text-white/60">{sharedQuizPreview.description || 'Không có mô tả'}</p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowShareCodeModal(false)}>
                Hủy
              </Button>
              <Button
                variant="primary"
                disabled={!sharedQuizPreview || importSaving}
                onClick={handleImportFromShareCode}
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
              >
                {importSaving ? 'Đang import...' : 'Import thành Quiz mới'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 6: REALISTIC PLAYER PREVIEW MODAL
         ══════════════════════════════════════════════════════════════════ */}
      {showPreviewModal && questions.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#161b22] border border-white/20 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  PREVIEW NGƯỜI CHƠI
                </span>
                <span className="text-sm font-semibold text-white/80">
                  Câu {previewIndex + 1} / {questions.length}
                </span>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Simulated Live Question View */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Timer Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-white/60">Thời gian trả lời</span>
                  <span className={`font-mono ${previewTimer <= 5 ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
                    {previewTimer}s
                  </span>
                </div>
                <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      previewTimer <= 5 ? 'bg-red-500' : 'bg-amber-400'
                    }`}
                    style={{
                      width: `${(previewTimer / (questions[previewIndex]?.timeLimit || 15)) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Media Image if present */}
              {questions[previewIndex]?.imageUrl && (
                <div className="w-full max-h-64 rounded-xl overflow-hidden border border-white/15 bg-black/40 flex items-center justify-center">
                  <img
                    src={questions[previewIndex].imageUrl}
                    alt="Question"
                    className="max-h-64 w-auto object-contain"
                  />
                </div>
              )}

              {/* Question Text */}
              <h3 className="text-xl font-bold text-white text-center leading-relaxed px-4">
                {questions[previewIndex]?.question}
              </h3>

              {/* 4 Interactive Answer Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                {['A', 'B', 'C', 'D'].map((key) => {
                  const optText = questions[previewIndex]?.[`option${key}`];
                  const isCorrect = questions[previewIndex]?.correctOption === key;
                  const isChosen = previewSelectedOption === key;

                  let btnStyle = 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20';
                  if (previewRevealed) {
                    if (isCorrect) {
                      btnStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-lg shadow-emerald-500/20';
                    } else if (isChosen) {
                      btnStyle = 'bg-red-500/20 border-red-500 text-red-300 font-bold';
                    } else {
                      btnStyle = 'bg-white/[0.02] border-white/5 text-white/30';
                    }
                  }

                  return (
                    <button
                      key={key}
                      disabled={previewRevealed}
                      onClick={() => handlePreviewAnswer(key)}
                      className={`p-4 rounded-xl border text-left flex items-center gap-3 transition-all ${btnStyle}`}
                    >
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                          previewRevealed && isCorrect
                            ? 'bg-emerald-500 text-black'
                            : previewRevealed && isChosen
                            ? 'bg-red-500 text-white'
                            : 'bg-white/10 text-white/80'
                        }`}
                      >
                        {key}
                      </span>
                      <span className="text-sm font-medium flex-1">{optText}</span>
                      {previewRevealed && isCorrect && <Check className="w-5 h-5 text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Revealed Explanation */}
              {previewRevealed && questions[previewIndex]?.explanation && (
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200 text-xs leading-relaxed">
                  <strong>💡 Giải thích: </strong>
                  {questions[previewIndex].explanation}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between bg-black/40">
              <Button
                variant="ghost"
                onClick={() => {
                  setPreviewRevealed(false);
                  setPreviewSelectedOption(null);
                  setPreviewTimer(questions[previewIndex]?.timeLimit || 15);
                  setPreviewTimerActive(true);
                }}
              >
                <RotateCcw className="w-4 h-4 mr-1.5" />
                Thử lại câu này
              </Button>
              <Button
                variant="primary"
                onClick={handleNextPreviewQuestion}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              >
                {previewIndex + 1 < questions.length ? (
                  <>
                    Câu tiếp theo
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </>
                ) : (
                  'Hoàn thành Xem trước'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── IMAGE ZOOM MODAL ── */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setZoomImage(null)}
        >
          <img src={zoomImage} alt="Zoomed preview" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}
