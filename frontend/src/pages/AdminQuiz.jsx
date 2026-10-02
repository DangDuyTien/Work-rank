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
  Pause,
  RotateCcw,
  Volume2,
} from 'lucide-react';
import { quizAdmin } from '../services/api';
import { useToast, useConfirm } from '../context/UiContext';
import { parseApiError } from '../utils/errors';
import { Button } from '../components/ui';

export default function AdminQuiz() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();

  // Navigation hierarchy view: 'SETS' | 'DETAIL'
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
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [audioUploadProgress, setAudioUploadProgress] = useState(0);
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
  const audioFileInputRef = useRef(null);
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
      message: `Bạn có chắc chắn muốn xóa bộ câu hỏi "${set.title}"? Tất cả câu hỏi trong bộ này cũng sẽ bị xóa vĩnh viễn.`,
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
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        }
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

  // Direct Audio Upload Handler
  const handleAudioFileUpload = async (file) => {
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Kích thước tệp âm thanh tối đa là 20MB');
      return;
    }

    try {
      setUploadingAudio(true);
      setAudioUploadProgress(10);
      const res = await quizAdmin.uploadAudio(file, (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setAudioUploadProgress(percent);
        }
      });

      if (res?.url) {
        setQForm((prev) => ({
          ...prev,
          audioUrl: res.url,
          type: 'MUSIC',
        }));
        toast.success('Tải tệp âm thanh lên thành công');
      }
    } catch (err) {
      toast.error(parseApiError(err, 'Tải tệp âm thanh thất bại'));
    } finally {
      setUploadingAudio(false);
      setAudioUploadProgress(0);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        handleFileUpload(file);
      } else if (file.type.startsWith('audio/')) {
        handleAudioFileUpload(file);
      }
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

  const totalQuestionsSum = quizSets.reduce((acc, s) => acc + (s.questionCount || 0), 0);
  const activeSetsCount = quizSets.filter((s) => s.isActive && s.status === 'PUBLISHED').length;

  return (
    <div
      className="min-h-screen bg-[#faf9f6] text-slate-900 p-4 sm:p-6 lg:p-8"
      onPaste={handlePaste}
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
    >
      {/* ── TOP HEADER / BREADCRUMB ── */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-amber-700 uppercase mb-1">
              <span>ADMIN</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span>TRÒ CHƠI</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-900 font-bold">QUIZ</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                <Zap className="w-5 h-5" />
              </span>
              Quản Lý Quiz & Bộ Câu Hỏi
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Thiết kế bộ câu hỏi, quản lý đa phương tiện (Hình ảnh / Âm thanh), cấu hình thời gian và chia sẻ mã quiz.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {activeView === 'DETAIL' ? (
              <>
                <Button variant="ghost" onClick={handleBackToSets} className="border border-slate-200 text-slate-700 hover:bg-slate-100">
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  Danh sách Quiz
                </Button>
                <Button variant="secondary" onClick={() => handleStartPlayerPreview(0)} className="bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100">
                  <Eye className="w-4 h-4 mr-1.5" />
                  Xem trước người chơi
                </Button>
                <Button variant="secondary" onClick={() => handleOpenImport(selectedSetId)} className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                  <Upload className="w-4 h-4 mr-1.5" />
                  Import vào Quiz
                </Button>
                <Button variant="primary" onClick={handleOpenAddQuestion} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Thêm câu hỏi
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setShowShareCodeModal(true)} className="border border-slate-200 text-slate-700 hover:bg-slate-100">
                  <Link2 className="w-4 h-4 mr-1.5 text-amber-600" />
                  Nhập mã Share
                </Button>
                <Button variant="secondary" onClick={() => handleOpenImport(null)} className="border border-slate-200 text-slate-700 hover:bg-slate-100">
                  <Upload className="w-4 h-4 mr-1.5 text-emerald-600" />
                  Import Quiz
                </Button>
                <Button variant="primary" onClick={handleOpenCreateSet} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Tạo Quiz Mới
                </Button>
                <button
                  type="button"
                  onClick={fetchQuizSets}
                  className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                  title="Làm mới"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── 3 STATS CARDS (HIGH CONTRAST & PROFESSIONAL) ── */}
        {activeView === 'SETS' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 flex items-center gap-4 transition-all hover:border-amber-300">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shrink-0">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Bộ Quiz</div>
                <div className="text-2xl font-black text-slate-900 mt-0.5">{quizSets.length}</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 flex items-center gap-4 transition-all hover:border-emerald-300">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shrink-0">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Câu Hỏi Đã Tạo</div>
                <div className="text-2xl font-black text-slate-900 mt-0.5">
                  {totalQuestionsSum}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 flex items-center gap-4 transition-all hover:border-blue-300">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shrink-0">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quiz Đang Kích Hoạt</div>
                <div className="text-2xl font-black text-slate-900 mt-0.5">
                  {activeSetsCount}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          VIEW 1: DANH SÁCH BỘ QUIZ (QUIZ SETS LIST)
         ══════════════════════════════════════════════════════════════════ */}
      {activeView === 'SETS' && (
        <div className="max-w-7xl mx-auto">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm kiếm Quiz theo tên..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-all"
              />
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-amber-500 font-medium"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="PUBLISHED">Đã xuất bản (Published)</option>
                <option value="DRAFT">Bản nháp (Draft)</option>
                <option value="ARCHIVED">Lưu trữ (Archived)</option>
              </select>
              <button
                type="button"
                onClick={fetchQuizSets}
                className="p-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
                title="Tải lại danh sách"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Sets Table / Grid */}
          {loading ? (
            <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-3 bg-white rounded-xl border border-slate-200/90 shadow-sm">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-600" />
              <span className="font-medium text-sm">Đang tải danh sách Quiz...</span>
            </div>
          ) : quizSets.length === 0 ? (
            <div className="py-12 px-6 text-center bg-white rounded-xl border border-slate-200/90 shadow-sm max-w-xl mx-auto my-6">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto mb-4">
                <Layers className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Chưa có bộ Quiz nào trong hệ thống</h3>
              <p className="text-xs sm:text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                Tạo bộ câu hỏi mới hoặc Import từ file JSON/CSV để sẵn sàng cho các trận đấu.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button variant="primary" onClick={handleOpenCreateSet} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs sm:text-sm">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Tạo Quiz Mới
                </Button>
                <Button variant="secondary" onClick={() => handleOpenImport(null)} className="border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs sm:text-sm">
                  <Upload className="w-4 h-4 mr-1.5" />
                  Import Quiz
                </Button>
                <Button variant="ghost" onClick={() => setShowShareCodeModal(true)} className="border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs sm:text-sm">
                  <Link2 className="w-4 h-4 mr-1.5 text-amber-600" />
                  Nhập mã Share
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {quizSets.map((set) => (
                <div
                  key={set.id}
                  className="bg-white rounded-xl border border-slate-200/90 shadow-sm hover:border-amber-400 hover:shadow-md transition-all p-5 flex flex-col justify-between group cursor-pointer"
                  onClick={() => handleOpenSetDetail(set)}
                >
                  <div>
                    {/* Category & Status */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {set.category || 'Chung'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {set.status === 'PUBLISHED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            PUBLISHED
                          </span>
                        ) : set.status === 'DRAFT' ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            DRAFT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            ARCHIVED
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-amber-700 transition-colors line-clamp-1 mb-1.5">
                      {set.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-4 min-h-[32px]">
                      {set.description || 'Chưa có mô tả cho bộ câu hỏi này.'}
                    </p>

                    {/* Stats & Share code */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5 font-bold text-slate-800">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                        {set.questionCount || 0} câu hỏi
                      </span>
                      {set.shareCode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(set.shareCode, 'mã chia sẻ');
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 border border-amber-200 text-[11px] text-amber-800 font-mono font-bold transition-colors"
                          title="Click để copy mã chia sẻ"
                        >
                          <Share2 className="w-3 h-3 text-amber-600" />
                          {set.shareCode}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between gap-1.5 pt-4 mt-4 border-t border-slate-100">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSetDetail(set);
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs flex-1"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Mở câu hỏi
                    </Button>
                    <button
                      type="button"
                      onClick={(e) => handleOpenExport(set, e)}
                      className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors"
                      title="Share / Export"
                    >
                      <Share2 className="w-4 h-4 text-blue-600" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDuplicateSet(set, e)}
                      className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors"
                      title="Nhân bản bộ Quiz"
                    >
                      <Copy className="w-4 h-4 text-emerald-600" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleOpenEditSet(set, e)}
                      className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors"
                      title="Chỉnh sửa thông tin"
                    >
                      <Edit2 className="w-4 h-4 text-amber-600" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSet(set, e)}
                      className="p-2 rounded-lg bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200 transition-colors"
                      title="Xóa bộ Quiz"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
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
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 mb-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    {selectedSet.category || 'Chung'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {selectedSet.status || 'PUBLISHED'}
                  </span>
                  {selectedSet.shareCode && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedSet.shareCode, 'mã chia sẻ')}
                      className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-mono font-bold text-amber-800 border border-slate-200 transition-colors"
                    >
                      <Share2 className="w-3 h-3 text-amber-600" />
                      Mã: {selectedSet.shareCode}
                    </button>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-1">{selectedSet.title}</h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  {selectedSet.description || 'Quản lý thứ tự và danh sách câu hỏi trong bộ Quiz.'}
                </p>
              </div>

              <div className="flex items-center gap-4 text-sm font-semibold text-slate-800 bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200">
                <span>Tổng số: <strong className="text-amber-700 text-base">{questions.length}</strong> câu hỏi</span>
              </div>
            </div>
          </div>

          {/* Question List Header / Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Danh Sách Câu Hỏi</h3>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                {questions.length} câu
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="secondary" size="sm" onClick={() => handleStartPlayerPreview(0)} className="border border-slate-200 text-slate-700 hover:bg-slate-100">
                <Eye className="w-3.5 h-3.5 mr-1 text-blue-600" />
                Xem trước
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleOpenImport(selectedSetId)} className="border border-slate-200 text-slate-700 hover:bg-slate-100">
                <Upload className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Import
              </Button>
              <Button variant="primary" size="sm" onClick={handleOpenAddQuestion} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Thêm câu hỏi
              </Button>
            </div>
          </div>

          {/* Question List Content */}
          {setDetailLoading ? (
            <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-3 bg-white rounded-xl border border-slate-200/90 shadow-sm">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-600" />
              <span className="font-medium text-sm">Đang tải câu hỏi...</span>
            </div>
          ) : questions.length === 0 ? (
            <div className="py-12 px-6 text-center bg-white rounded-xl border border-slate-200/90 shadow-sm max-w-md mx-auto my-6">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto mb-3">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Chưa có câu hỏi nào trong bộ này</h3>
              <p className="text-xs text-slate-500 mb-5">
                Nhấn Thêm câu hỏi hoặc Import từ JSON/CSV để bắt đầu soạn câu hỏi cho bộ này.
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="primary" size="sm" onClick={handleOpenAddQuestion} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Thêm câu hỏi đầu tiên
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleOpenImport(selectedSetId)} className="border border-slate-200 text-slate-700">
                  <Upload className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Import
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-white rounded-xl border border-slate-200/90 shadow-sm hover:border-slate-300 transition-all p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Index & Reorder Controls */}
                    <div className="flex flex-col items-center justify-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1.5 shrink-0 w-11">
                      <button
                        type="button"
                        onClick={() => handleMoveQuestion(idx, -1)}
                        disabled={idx === 0}
                        className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Di chuyển lên"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-black text-slate-700 font-mono">#{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleMoveQuestion(idx, 1)}
                        disabled={idx === questions.length - 1}
                        className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Di chuyển xuống"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Media Thumbnail or Type Icon */}
                    <div className="shrink-0">
                      {q.type === 'IMAGE' && q.imageUrl ? (
                        <div
                          className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer relative group"
                          onClick={() => setZoomImage(q.imageUrl)}
                          title="Click để phóng to ảnh"
                        >
                          <img
                            src={q.imageUrl}
                            alt="Question thumbnail"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            onError={(e) => {
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=100&auto=format&fit=crop&q=80';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      ) : q.type === 'MUSIC' ? (
                        <div className="w-16 h-16 rounded-lg bg-purple-50 border border-purple-200 flex flex-col items-center justify-center text-purple-600 gap-1">
                          <Music className="w-5 h-5" />
                          <span className="text-[10px] font-bold">AUDIO</span>
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-blue-50 border border-blue-200 flex flex-col items-center justify-center text-blue-600 gap-1">
                          <FileText className="w-5 h-5" />
                          <span className="text-[10px] font-bold">TEXT</span>
                        </div>
                      )}
                    </div>

                    {/* Question Content & Options */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                          q.type === 'IMAGE'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : q.type === 'MUSIC'
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}>
                          {q.type === 'IMAGE' ? 'Đoán Hình' : q.type === 'MUSIC' ? 'Đoán Nhạc' : 'Chữ'}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {q.timeLimit || 15}s
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Award className="w-3 h-3 text-amber-600" />
                          {q.points || 1000}đ
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 mb-2.5 line-clamp-2">
                        {q.question}
                      </h4>

                      {/* 4 Options Grid (Correct answer highlighted in green) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                        {[
                          { key: 'A', text: q.optionA },
                          { key: 'B', text: q.optionB },
                          { key: 'C', text: q.optionC },
                          { key: 'D', text: q.optionD },
                        ].map((opt) => {
                          const isCorrect = q.correctOption === opt.key;
                          return (
                            <div
                              key={opt.key}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${
                                isCorrect
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              <span
                                className={`w-4 h-4 rounded text-[10px] font-mono font-bold flex items-center justify-center shrink-0 ${
                                  isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {opt.key}
                              </span>
                              <span className="truncate">{opt.text}</span>
                              {isCorrect && <Check className="w-3.5 h-3.5 text-emerald-600 ml-auto shrink-0" />}
                            </div>
                          );
                        })}
                      </div>

                      {/* Optional inline audio player preview for MUSIC question */}
                      {q.type === 'MUSIC' && q.audioUrl && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-2">
                          <audio controls className="h-7 w-full max-w-sm" src={q.audioUrl}>
                            Trình duyệt không hỗ trợ audio
                          </audio>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex md:flex-col items-center justify-end gap-1.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleOpenEditQuestion(q)}
                      className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 transition-colors"
                      title="Chỉnh sửa câu hỏi"
                    >
                      <Edit2 className="w-4 h-4 text-amber-600" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateQuestion(q)}
                      className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 transition-colors"
                      title="Nhân bản câu hỏi"
                    >
                      <Copy className="w-4 h-4 text-emerald-600" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(q)}
                      className="p-2 rounded-lg bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 transition-colors"
                      title="Xóa câu hỏi"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 1: CREATE / EDIT QUIZ SET
         ══════════════════════════════════════════════════════════════════ */}
      {showSetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-amber-600" />
                {editingSet ? 'Chỉnh Sửa Bộ Quiz' : 'Tạo Bộ Quiz Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setShowSetModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tên Bộ Quiz <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đố Vui Công Nghệ 2026..."
                  value={setForm.title}
                  onChange={(e) => setSetForm({ ...setForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mô Tả Bộ Câu Hỏi
                </label>
                <textarea
                  rows={3}
                  placeholder="Mô tả tóm tắt chủ đề, đối tượng người chơi..."
                  value={setForm.description}
                  onChange={(e) => setSetForm({ ...setForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Chủ Đề (Category)
                  </label>
                  <select
                    value={setForm.category}
                    onChange={(e) => setSetForm({ ...setForm, category: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                  >
                    <option value="Chung">Chung</option>
                    <option value="Công nghệ">Công nghệ</option>
                    <option value="Âm nhạc">Âm nhạc</option>
                    <option value="Điện ảnh">Điện ảnh</option>
                    <option value="Văn hóa">Văn hóa</option>
                    <option value="Khoa học">Khoa học</option>
                    <option value="Thể thao">Thể thao</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Trạng Thái
                  </label>
                  <select
                    value={setForm.status}
                    onChange={(e) => setSetForm({ ...setForm, status: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                  >
                    <option value="PUBLISHED">Đã xuất bản (PUBLISHED)</option>
                    <option value="DRAFT">Bản nháp (DRAFT)</option>
                    <option value="ARCHIVED">Lưu trữ (ARCHIVED)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <Button variant="ghost" onClick={() => setShowSetModal(false)} className="border border-slate-200 text-slate-700">
                Hủy
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveSet}
                disabled={savingSet}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                {savingSet ? 'Đang lưu...' : editingSet ? 'Cập nhật' : 'Tạo mới'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 2: QUESTION EDITOR (CREATE / EDIT QUESTION)
         ══════════════════════════════════════════════════════════════════ */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-600" />
                {editingQuestion ? 'Chỉnh Sửa Câu Hỏi' : 'Thêm Câu Hỏi Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setShowQuestionModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Question Type Tabs */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Loại Câu Hỏi
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'IMAGE', label: 'Đoán hình (Image)', icon: ImageIcon },
                    { key: 'MUSIC', label: 'Đoán nhạc (Audio)', icon: Music },
                    { key: 'TEXT', label: 'Trắc nghiệm chữ (Text)', icon: FileText },
                  ].map((t) => {
                    const Icon = t.icon;
                    const active = qForm.type === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setQForm({ ...qForm, type: t.key })}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                          active
                            ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Question Text */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nội Dung Câu Hỏi <span className="text-red-500">*</span>
                </label>
                <textarea
                  ref={questionInputRef}
                  rows={2}
                  placeholder="Ví dụ: Hình ảnh dưới đây là của nhân vật / địa danh nào?"
                  value={qForm.question}
                  onChange={(e) => setQForm({ ...qForm, question: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white resize-none"
                />
              </div>

              {/* Media Section: Image Upload / Audio Upload */}
              {qForm.type === 'IMAGE' && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Hình Ảnh Câu Hỏi
                  </label>

                  {qForm.imageUrl ? (
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 rounded-lg bg-slate-200 border border-slate-300 overflow-hidden shrink-0">
                        <img
                          src={qForm.imageUrl}
                          alt="Question preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-slate-600 truncate mb-2">{qForm.imageUrl}</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Đổi ảnh khác
                          </button>
                          <button
                            type="button"
                            onClick={() => setQForm({ ...qForm, imageUrl: '' })}
                            className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-100"
                          >
                            Xóa ảnh
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-amber-500 transition-colors cursor-pointer bg-white"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-700 mb-1">
                        Kéo thả ảnh vào đây, hoặc click để chọn tệp
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Hỗ trợ PNG, JPG, WEBP, GIF (tối đa 10MB). Bạn cũng có thể dán ảnh từ clipboard (Ctrl+V / Cmd+V).
                      </p>
                      {uploadingImage && (
                        <div className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-amber-600">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Đang tải lên ({uploadProgress}%)...</span>
                        </div>
                      )}
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                    }}
                  />

                  <div className="mt-2.5">
                    <input
                      type="text"
                      placeholder="Hoặc dán URL hình ảnh trực tiếp..."
                      value={qForm.imageUrl}
                      onChange={(e) => setQForm({ ...qForm, imageUrl: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}

              {qForm.type === 'MUSIC' && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Âm Thanh / Đoạn Nhạc
                  </label>

                  {qForm.audioUrl ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <audio controls className="h-8 flex-1" src={qForm.audioUrl}>
                          Trình duyệt không hỗ trợ audio
                        </audio>
                        <button
                          type="button"
                          onClick={() => setQForm({ ...qForm, audioUrl: '' })}
                          className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-100"
                        >
                          Xóa
                        </button>
                      </div>
                      <p className="text-[11px] font-mono text-slate-500 truncate">{qForm.audioUrl}</p>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-purple-500 transition-colors cursor-pointer bg-white"
                      onClick={() => audioFileInputRef.current?.click()}
                    >
                      <Music className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-700 mb-1">
                        Kéo thả file âm thanh vào đây, hoặc click để chọn tệp
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Hỗ trợ MP3, OGG, WAV, AAC, M4A (tối đa 20MB).
                      </p>
                      {uploadingAudio && (
                        <div className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-purple-600">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Đang tải âm thanh lên ({audioUploadProgress}%)...</span>
                        </div>
                      )}
                    </div>
                  )}

                  <input
                    ref={audioFileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleAudioFileUpload(e.target.files[0]);
                    }}
                  />

                  <div className="mt-2.5">
                    <input
                      type="text"
                      placeholder="Hoặc dán URL audio trực tiếp (MP3/OGG)..."
                      value={qForm.audioUrl}
                      onChange={(e) => setQForm({ ...qForm, audioUrl: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              )}

              {/* 4 Answers: A, B, C, D */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    4 Phương Án Trả Lời (Chọn Radio là Đáp Án Đúng) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Đáp án đúng: Phương án {qForm.correctOption}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: 'A', field: 'optionA', label: 'Phương án A' },
                    { key: 'B', field: 'optionB', label: 'Phương án B' },
                    { key: 'C', field: 'optionC', label: 'Phương án C' },
                    { key: 'D', field: 'optionD', label: 'Phương án D' },
                  ].map((opt) => {
                    const isCorrect = qForm.correctOption === opt.key;
                    return (
                      <div
                        key={opt.key}
                        className={`p-3 rounded-xl border transition-all ${
                          isCorrect
                            ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-400/20'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="correctOption"
                              checked={isCorrect}
                              onChange={() => setQForm({ ...qForm, correctOption: opt.key })}
                              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-xs font-bold text-slate-800">{opt.label}</span>
                          </label>
                          {isCorrect && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Check className="w-3 h-3" /> ĐÚNG
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder={`Nội dung ${opt.label}...`}
                          value={qForm[opt.field]}
                          onChange={(e) => setQForm({ ...qForm, [opt.field]: e.target.value })}
                          className={`w-full px-3 py-2 rounded-lg text-sm bg-white border ${
                            isCorrect ? 'border-emerald-300 text-slate-900 font-medium' : 'border-slate-200 text-slate-800'
                          } focus:outline-none focus:border-amber-500`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Explanation (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Giải Thích Đáp Án (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="Giải thích ngắn gọn xuất hiện sau khi người chơi trả lời..."
                  value={qForm.explanation}
                  onChange={(e) => setQForm({ ...qForm, explanation: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              {/* Time & Points */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Thời Gian Trả Lời (Giây)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={60}
                    value={qForm.timeLimit}
                    onChange={(e) => setQForm({ ...qForm, timeLimit: Math.max(5, parseInt(e.target.value) || 15) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Điểm Tối Đa (Points)
                  </label>
                  <input
                    type="number"
                    min={100}
                    max={5000}
                    step={100}
                    value={qForm.points}
                    onChange={(e) => setQForm({ ...qForm, points: Math.max(100, parseInt(e.target.value) || 1000) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2.5">
              {!editingQuestion ? (
                <button
                  type="button"
                  onClick={() => handleSaveQuestion(true)}
                  disabled={savingQuestion}
                  className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200"
                >
                  Lưu & Tiếp tục thêm
                </button>
              ) : <div />}

              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setShowQuestionModal(false)} className="border border-slate-200 text-slate-700">
                  Hủy
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleSaveQuestion(false)}
                  disabled={savingQuestion}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                >
                  {savingQuestion ? 'Đang lưu...' : editingQuestion ? 'Cập nhật câu hỏi' : 'Lưu câu hỏi'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 3: IMPORT MODAL (JSON / CSV / TEXT)
         ══════════════════════════════════════════════════════════════════ */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                Import Bộ Câu Hỏi
              </h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Target set selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Đích Đến Của Dữ Liệu
                </label>
                <select
                  value={importTargetSetId}
                  onChange={(e) => setImportTargetSetId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value="NEW">+ Tạo Bộ Quiz Mới Từ Dữ Liệu</option>
                  {quizSets.map((s) => (
                    <option key={s.id} value={s.id}>
                      Thêm vào: {s.title} ({s.questionCount || 0} câu)
                    </option>
                  ))}
                </select>
              </div>

              {importTargetSetId === 'NEW' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tên Bộ Quiz Mới
                  </label>
                  <input
                    type="text"
                    value={importTargetTitle}
                    onChange={(e) => setImportTargetTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              {/* Source format switcher */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Định Dạng Nguồn
                </label>
                <div className="flex gap-2">
                  {['JSON', 'CSV', 'TEXT'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setImportSourceType(type)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        importSourceType === type
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* File upload or paste */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Nội Dung Dữ Liệu
                  </label>
                  <button
                    type="button"
                    onClick={() => importFileInputRef.current?.click()}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <Upload className="w-3.5 h-3.5" /> Chọn tệp {importSourceType}
                  </button>
                  <input
                    ref={importFileInputRef}
                    type="file"
                    accept=".json,.csv,.txt"
                    className="hidden"
                    onChange={handleImportFileSelect}
                  />
                </div>

                <textarea
                  rows={6}
                  placeholder={`Dán nội dung ${importSourceType} vào đây...`}
                  value={importContent}
                  onChange={(e) => setImportContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white resize-none"
                />
              </div>

              {/* Validate action */}
              <div className="flex justify-between items-center pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleValidateImport}
                  disabled={importParsing || !importContent.trim()}
                  className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                >
                  {importParsing ? 'Đang phân tích...' : '1. Phân Tích & Kiểm Tra Dữ Liệu'}
                </Button>
              </div>

              {/* Validation Result Preview */}
              {importPreviewData && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700">Kết quả phân tích:</span>
                    <div className="flex gap-2">
                      <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                        ✓ {importPreviewData.validCount} hợp lệ
                      </span>
                      {importPreviewData.errorCount > 0 && (
                        <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded">
                          ⚠ {importPreviewData.errorCount} lỗi
                        </span>
                      )}
                    </div>
                  </div>

                  {importPreviewData.items && importPreviewData.items.length > 0 && (
                    <div className="max-h-36 overflow-y-auto space-y-1.5 text-xs pt-1">
                      {importPreviewData.items.slice(0, 5).map((item, i) => (
                        <div
                          key={i}
                          className={`p-2 rounded border flex items-center justify-between gap-2 ${
                            item.isValid ? 'bg-white border-slate-200' : 'bg-red-50 border-red-200 text-red-700'
                          }`}
                        >
                          <span className="truncate">#{i + 1}. {item.data?.question || item.error}</span>
                          <span className="shrink-0 font-bold">
                            {item.isValid ? '✓ OK' : '✕ Lỗi'}
                          </span>
                        </div>
                      ))}
                      {importPreviewData.items.length > 5 && (
                        <p className="text-[11px] text-slate-500 text-center pt-1">
                          ...và {importPreviewData.items.length - 5} câu hỏi khác
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
              <Button variant="ghost" onClick={() => setShowImportModal(false)} className="border border-slate-200 text-slate-700">
                Hủy
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmImport}
                disabled={!importPreviewData || importPreviewData.validCount === 0 || importSaving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {importSaving ? 'Đang lưu vào hệ thống...' : `2. Xác Nhận Import (${importPreviewData?.validCount || 0} câu)`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 4: SHARE CODE MODAL (QUICK IMPORT FROM SHARE CODE)
         ══════════════════════════════════════════════════════════════════ */}
      {showShareCodeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Link2 className="w-5 h-5 text-amber-600" />
                Nhập Mã Chia Sẻ (Share Code)
              </h3>
              <button
                type="button"
                onClick={() => setShowShareCodeModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mã Chia Sẻ 8 Ký Tự
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ví dụ: WR9A2B3C..."
                    value={shareCodeInput}
                    onChange={(e) => setShareCodeInput(e.target.value.toUpperCase())}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono font-bold tracking-wider text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 uppercase"
                  />
                  <Button
                    variant="primary"
                    onClick={handleFetchSharedQuiz}
                    disabled={fetchingShare || !shareCodeInput.trim()}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                  >
                    {fetchingShare ? 'Tìm...' : 'Kiểm tra'}
                  </Button>
                </div>
              </div>

              {/* Shared Quiz Preview */}
              {sharedQuizPreview && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    Tìm thấy bộ Quiz
                  </span>
                  <h4 className="text-base font-bold text-slate-900">{sharedQuizPreview.title}</h4>
                  <p className="text-xs text-slate-500">{sharedQuizPreview.description || 'Không có mô tả'}</p>
                  <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-200">
                    <span>Chủ đề: <strong>{sharedQuizPreview.category}</strong></span>
                    <span>Số câu hỏi: <strong>{sharedQuizPreview.questionCount}</strong></span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <Button variant="ghost" onClick={() => setShowShareCodeModal(false)} className="border border-slate-200 text-slate-700">
                Đóng
              </Button>
              {sharedQuizPreview && (
                <Button
                  variant="primary"
                  onClick={handleImportFromShareCode}
                  disabled={importSaving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {importSaving ? 'Đang tải về...' : 'Tải Về Hệ Thống Của Tôi'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 5: EXPORT / SHARE MODAL
         ══════════════════════════════════════════════════════════════════ */}
      {showExportModal && exportingSet && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-blue-600" />
                Chia Sẻ & Xuất Dữ Liệu
              </h3>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mã Chia Sẻ Trực Tiếp
                </label>
                <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="font-mono text-base font-black text-amber-800 tracking-wider flex-1">
                    {exportingSet.shareCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(exportingSet.shareCode, 'mã chia sẻ')}
                    className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
                    title="Sao chép mã"
                  >
                    <Copy className="w-4 h-4 text-amber-600" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Người khác có thể nhập mã này tại trang Quản lý Quiz để tự động sao chép toàn bộ bộ câu hỏi.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Tải Về Tệp Dữ Liệu
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <a
                    href={`/api/admin/quiz/sets/${exportingSet.id}/export?format=json`}
                    download
                    className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-800 transition-colors"
                  >
                    <FileJson className="w-4 h-4 text-amber-600" />
                    <span>Xuất file JSON</span>
                  </a>
                  <a
                    href={`/api/admin/quiz/sets/${exportingSet.id}/export?format=csv`}
                    download
                    className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-800 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Xuất file CSV</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <Button variant="ghost" onClick={() => setShowExportModal(false)} className="border border-slate-200 text-slate-700">
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 6: REALISTIC PLAYER PREVIEW MODAL
         ══════════════════════════════════════════════════════════════════ */}
      {showPreviewModal && questions[previewIndex] && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Preview Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="px-2 py-0.5 rounded bg-amber-500 text-black">XEM TRƯỚC</span>
                <span>Câu {previewIndex + 1} / {questions.length}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-black font-mono text-amber-400">
                  {previewTimer}s
                </span>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Countdown bar */}
            <div className="h-1.5 bg-slate-100 w-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-1000 ease-linear"
                style={{
                  width: `${(previewTimer / (questions[previewIndex]?.timeLimit || 15)) * 100}%`,
                }}
              />
            </div>

            <div className="p-6 space-y-5">
              {/* Media element */}
              {questions[previewIndex].type === 'IMAGE' && questions[previewIndex].imageUrl && (
                <div className="w-full max-h-64 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                  <img
                    src={questions[previewIndex].imageUrl}
                    alt="Preview Question"
                    className="max-h-64 object-contain"
                  />
                </div>
              )}

              {questions[previewIndex].type === 'MUSIC' && questions[previewIndex].audioUrl && (
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 flex items-center gap-3">
                  <Music className="w-6 h-6 text-purple-600 shrink-0" />
                  <audio controls autoPlay className="w-full h-8" src={questions[previewIndex].audioUrl}>
                    Trình duyệt không hỗ trợ audio
                  </audio>
                </div>
              )}

              {/* Question text */}
              <h3 className="text-lg font-black text-slate-900 text-center">
                {questions[previewIndex].question}
              </h3>

              {/* 4 Interactive Answer Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: 'A', text: questions[previewIndex].optionA },
                  { key: 'B', text: questions[previewIndex].optionB },
                  { key: 'C', text: questions[previewIndex].optionC },
                  { key: 'D', text: questions[previewIndex].optionD },
                ].map((opt) => {
                  const isSelected = previewSelectedOption === opt.key;
                  const isCorrect = questions[previewIndex].correctOption === opt.key;

                  let btnStyle = 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100';
                  if (previewRevealed) {
                    if (isCorrect) {
                      btnStyle = 'bg-emerald-500 text-white border-emerald-600 font-bold';
                    } else if (isSelected && !isCorrect) {
                      btnStyle = 'bg-red-500 text-white border-red-600';
                    } else {
                      btnStyle = 'bg-slate-50 border-slate-200 text-slate-400 opacity-60';
                    }
                  } else if (isSelected) {
                    btnStyle = 'bg-amber-500 text-black border-amber-600 font-bold';
                  }

                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handlePreviewAnswer(opt.key)}
                      disabled={previewRevealed}
                      className={`p-3.5 rounded-xl border text-sm font-semibold flex items-center gap-3 transition-all ${btnStyle}`}
                    >
                      <span className="w-6 h-6 rounded-lg bg-black/10 flex items-center justify-center font-mono font-black text-xs shrink-0">
                        {opt.key}
                      </span>
                      <span className="text-left flex-1">{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              {/* Reveal explanation */}
              {previewRevealed && questions[previewIndex].explanation && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                  <strong className="text-slate-900">Giải thích: </strong>
                  {questions[previewIndex].explanation}
                </div>
              )}
            </div>

            {/* Next Question Control */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {previewRevealed ? 'Đã hiển thị kết quả đáp án' : 'Bấm vào một phương án để trả lời'}
              </span>
              <Button
                variant="primary"
                onClick={handleNextPreviewQuestion}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs"
              >
                {previewIndex + 1 < questions.length ? 'Câu tiếp theo' : 'Hoàn tất'}
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 7: IMAGE ZOOM MODAL
         ══════════════════════════════════════════════════════════════════ */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img
              src={zoomImage}
              alt="Zoomed quiz media"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-white/20"
            />
            <button
              type="button"
              onClick={() => setZoomImage(null)}
              className="absolute top-2 right-2 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
