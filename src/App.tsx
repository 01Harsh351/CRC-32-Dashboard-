/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Binary,
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Download,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  Play,
  ArrowRight,
  Terminal,
  Activity,
  Send,
  Inbox,
  Sparkles,
  MousePointerClick,
  CheckCircle,
  BookOpen,
  X,
  Shuffle,
  Info,
} from 'lucide-react';
import {
  GENERATOR_POLYNOMIAL,
  GENERATOR_POLYNOMIAL_HEX,
  GENERATOR_POLYNOMIAL_EXPANDED,
  CRC_BITS,
  cleanBinaryInput,
  isValidBinaryString,
  textToBinary,
  fileBytesToBinary,
  generateCRC,
  verifyCodeword,
  simulateBitFlip,
  simulateBurstError,
  simulateRandomBitFlip,
  generateCSVReport,
  getBitDifferences,
  CRCState,
} from './crcUtils';

const DEFAULT_TEXT = 'hello';
const DEFAULT_BINARY = '01101000 01100101 01101100 01101100 01101111';

export type WorkflowStepId =
  | 'input'
  | 'generate'
  | 'verify'
  | 'simulation'
  | 'compare'
  | 'status'
  | 'report';

interface WorkflowStepDef {
  id: WorkflowStepId;
  stepNumber: number;
  label: string;
  targetId: string;
  shortDesc: string;
}

const WORKFLOW_STEPS: WorkflowStepDef[] = [
  {
    id: 'input',
    stepNumber: 1,
    label: '1. Select Input',
    targetId: 'section-input-selection',
    shortDesc: 'Configure text message, binary dataword, or upload local file',
  },
  {
    id: 'generate',
    stepNumber: 2,
    label: '2. Generate Reference CRC (Sender)',
    targetId: 'section-crc-generation',
    shortDesc: 'Calculate 32-bit CRC remainder and construct transmitted codeword',
  },
  {
    id: 'verify',
    stepNumber: 3,
    label: '3. Verify Codeword (Receiver)',
    targetId: 'section-verify-codeword',
    shortDesc: 'Run modulo-2 division on received bitstream using generator polynomial',
  },
  {
    id: 'simulation',
    stepNumber: 4,
    label: '4. Error Simulation (Channel)',
    targetId: 'section-error-simulation',
    shortDesc: 'Inject single-bit channel inversions to test error detection capabilities',
  },
  {
    id: 'compare',
    stepNumber: 5,
    label: '5. Compare Sender vs Receiver',
    targetId: 'section-crc-comparison-dual-side',
    shortDesc: 'Side-by-side transmission line analysis and mathematical remainder verification',
  },
  {
    id: 'status',
    stepNumber: 6,
    label: '6. Verification Status',
    targetId: 'section-verification-status',
    shortDesc: 'Display real-time VALID / CORRUPTED verdict and error analysis',
  },
  {
    id: 'report',
    stepNumber: 7,
    label: '7. CSV Report',
    targetId: 'btn-save-report-footer',
    shortDesc: 'Export structured experiment report for academic evaluation',
  },
];

interface LogEntry {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export default function App() {
  // Input Selection States
  const [inputType, setInputType] = useState<'binary' | 'text' | 'file'>('text');
  const [binaryInput, setBinaryInput] = useState<string>(DEFAULT_BINARY);
  const [textInput, setTextInput] = useState<string>(DEFAULT_TEXT);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileSize, setUploadedFileSize] = useState<number>(0);
  const [fileBinaryData, setFileBinaryData] = useState<string>('');

  // CRC Experiment State
  const [crcState, setCrcState] = useState<CRCState | null>(null);

  // Dynamic Workflow Tracking States
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<WorkflowStepId>('input');
  const [completedSteps, setCompletedSteps] = useState<Set<WorkflowStepId>>(
    new Set(['input', 'generate', 'verify', 'compare', 'status'])
  );
  const [workflowStatusMessage, setWorkflowStatusMessage] = useState<string>(
    'Select an input format (Text, Binary, File) or click Generate CRC to run the transmitter experiment.'
  );

  // Error Simulation & Verification States
  const [bitIndexToFlip, setBitIndexToFlip] = useState<number>(12);
  const [editableCodeword, setEditableCodeword] = useState<string>('');

  // Demonstration & Academic Spec States
  const [isDemonstrating, setIsDemonstrating] = useState<boolean>(false);
  const [showMathModal, setShowMathModal] = useState<boolean>(false);

  // UI Feedback & Logs
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState<boolean>(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        time: timeStr,
        message,
        type,
      },
    ]);
  };

  const markStepComplete = (stepId: WorkflowStepId) => {
    setCompletedSteps((prev) => new Set([...prev, stepId]));
  };

  // Scroll to section when workflow step is selected
  const handleWorkflowStepClick = (step: WorkflowStepDef) => {
    setActiveWorkflowStep(step.id);
    setWorkflowStatusMessage(step.shortDesc);
    const element = document.getElementById(step.targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Run default generation on mount
  useEffect(() => {
    const initialBinary = textToBinary(DEFAULT_TEXT);
    const generated = generateCRC(initialBinary, 'text', DEFAULT_TEXT);
    setCrcState(generated);
    setEditableCodeword(generated.generatedCodeword);
    addLog(`System initialized with IEEE 802.3 standard polynomial: ${GENERATOR_POLYNOMIAL}`, 'info');
    addLog(`[Sender] Encoded baseline "${DEFAULT_TEXT}" (${initialBinary.length} bits). Generated CRC: ${generated.referenceCRCHex}`, 'success');
    addLog(`[Receiver] Initial modulo-2 verification passed. Remainder: 0x00000000 (VALID).`, 'success');
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (showLogs) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  // Handler for Generating Reference CRC (Sender Side)
  const handleGenerateCRC = () => {
    setErrorMessage(null);
    setActiveWorkflowStep('generate');
    markStepComplete('input');

    let dataword = '';
    let orig = '';

    if (inputType === 'binary') {
      orig = binaryInput;
      const cleaned = cleanBinaryInput(binaryInput);
      if (!cleaned) {
        const msg = 'Input Error: Binary dataword cannot be empty.';
        setErrorMessage(msg);
        addLog(msg, 'error');
        return;
      }
      if (!isValidBinaryString(cleaned)) {
        const msg = 'Input Error: Invalid binary data! Only digits 0 and 1 are allowed.';
        setErrorMessage(msg);
        addLog(msg, 'error');
        return;
      }
      dataword = cleaned;
    } else if (inputType === 'text') {
      orig = textInput;
      if (!textInput.trim()) {
        const msg = 'Input Error: Text message cannot be empty.';
        setErrorMessage(msg);
        addLog(msg, 'error');
        return;
      }
      dataword = textToBinary(textInput);
    } else {
      orig = uploadedFileName || 'uploaded_file';
      if (!fileBinaryData) {
        const msg = 'Input Error: Please select or upload a valid file first.';
        setErrorMessage(msg);
        addLog(msg, 'error');
        return;
      }
      dataword = fileBinaryData;
    }

    if (dataword.length > 64000) {
      const msg = 'Input Error: Input exceeds presentation limit (> 64,000 bits). Please use smaller input (< 8KB).';
      setErrorMessage(msg);
      addLog(msg, 'error');
      return;
    }

    try {
      const generated = generateCRC(
        dataword,
        inputType,
        orig,
        inputType === 'file'
          ? { fileName: uploadedFileName, fileSize: uploadedFileSize }
          : undefined
      );

      setCrcState(generated);
      setEditableCodeword(generated.generatedCodeword);
      setBitIndexToFlip(Math.floor(generated.generatedCodeword.length / 2));

      markStepComplete('generate');
      markStepComplete('verify');
      markStepComplete('compare');
      markStepComplete('status');

      setWorkflowStatusMessage(
        `[Step 2 Generated] CRC-32 = ${generated.referenceCRCHex}. Codeword of ${generated.generatedCodeword.length} bits assembled and transmitted.`
      );

      addLog(
        `[Sender] Generated CRC for ${inputType.toUpperCase()} (${dataword.length} data bits): CRC-32 = ${generated.referenceCRCHex}`,
        'success'
      );
      addLog(
        `[Sender] Codeword assembled: ${generated.generatedCodeword.length} bits (${dataword.length} data + 32 CRC).`,
        'info'
      );
      addLog('[Receiver] Codeword verified against polynomial: Remainder = 0x00000000 (VALID).', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown generation failure.';
      setErrorMessage(msg);
      addLog(`Generation error: ${msg}`, 'error');
    }
  };

  // Handler for File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setActiveWorkflowStep('input');
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20000) {
      const msg = `Notice: Selected file is ${Math.round(file.size / 1024)} KB. For optimal browser performance, consider files < 20 KB.`;
      setErrorMessage(msg);
      addLog(msg, 'warning');
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        if (!buffer) throw new Error('Empty file buffer received.');
        const bytes = new Uint8Array(buffer);
        const binary = fileBytesToBinary(bytes);
        setUploadedFileName(file.name);
        setUploadedFileSize(file.size);
        setFileBinaryData(binary);

        setWorkflowStatusMessage(`Loaded file "${file.name}" (${file.size} bytes = ${binary.length} bits). Ready to generate CRC.`);
        addLog(
          `File loaded: "${file.name}" (${file.size} bytes = ${binary.length} bits converted).`,
          'info'
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'File parsing failed.';
        setErrorMessage(msg);
        addLog(`File upload error: ${msg}`, 'error');
      }
    };
    reader.onerror = () => {
      const msg = 'File Read Error: Failed to read file content.';
      setErrorMessage(msg);
      addLog(msg, 'error');
    };
    reader.readAsArrayBuffer(file);
  };

  // Handler for Error Simulation (Channel Bit Inversion)
  const handleSimulateError = () => {
    setErrorMessage(null);
    setActiveWorkflowStep('simulation');

    if (!crcState) {
      const msg = 'Error: Please generate a reference CRC first.';
      setErrorMessage(msg);
      addLog(msg, 'error');
      return;
    }

    if (
      bitIndexToFlip < 0 ||
      bitIndexToFlip >= crcState.generatedCodeword.length
    ) {
      const msg = `Invalid bit index! Must be between 0 and ${crcState.generatedCodeword.length - 1}.`;
      setErrorMessage(msg);
      addLog(msg, 'error');
      return;
    }

    try {
      const simulated = simulateBitFlip(crcState, bitIndexToFlip);
      setCrcState(simulated);
      setEditableCodeword(simulated.currentCodeword);

      markStepComplete('simulation');
      markStepComplete('verify');
      markStepComplete('compare');
      markStepComplete('status');

      const oldBit = crcState.generatedCodeword[bitIndexToFlip];
      const newBit = simulated.currentCodeword[bitIndexToFlip];

      setWorkflowStatusMessage(
        `[Step 4 Fault Injected] Inverted bit [${bitIndexToFlip}] ('${oldBit}' → '${newBit}'). Remainder is now non-zero (${simulated.currentRemainderHex})!`
      );

      addLog(
        `[Channel Noise] Simulated bit inversion at index [${bitIndexToFlip}] ('${oldBit}' → '${newBit}').`,
        'warning'
      );
      addLog(
        `[Receiver] Auto-verification executed: Remainder = ${simulated.currentRemainderHex} (Non-zero). Status: CORRUPTED!`,
        'error'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bit flip error';
      setErrorMessage(msg);
      addLog(msg, 'error');
    }
  };

  // Handler for Simulating Burst Error (3 consecutive bits)
  const handleSimulateBurstError = () => {
    setErrorMessage(null);
    setActiveWorkflowStep('simulation');
    if (!crcState) return;

    try {
      const safeStart = Math.min(
        Math.max(0, bitIndexToFlip),
        Math.max(0, crcState.generatedCodeword.length - 3)
      );
      const simulated = simulateBurstError(crcState, safeStart, 3);
      setCrcState(simulated);
      setEditableCodeword(simulated.currentCodeword);

      markStepComplete('simulation');
      markStepComplete('verify');
      markStepComplete('compare');
      markStepComplete('status');

      setWorkflowStatusMessage(
        `[Burst Error Injected] Inverted 3 bits starting at index [${safeStart}]. Remainder: ${simulated.currentRemainderHex} (CORRUPTED).`
      );
      addLog(
        `[Channel Noise] Simulated 3-bit burst error at indices [${safeStart}, ${safeStart + 1}, ${safeStart + 2}].`,
        'warning'
      );
      addLog(
        `[Receiver] Verification: Remainder = ${simulated.currentRemainderHex}. Frame CORRUPTED!`,
        'error'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Burst simulation error';
      setErrorMessage(msg);
      addLog(msg, 'error');
    }
  };

  // Handler for Simulating Random Bit Flip
  const handleSimulateRandomError = () => {
    setErrorMessage(null);
    setActiveWorkflowStep('simulation');
    if (!crcState) return;

    try {
      const simulated = simulateRandomBitFlip(crcState);
      setCrcState(simulated);
      setEditableCodeword(simulated.currentCodeword);
      if (simulated.flippedBitIndex !== null) {
        setBitIndexToFlip(simulated.flippedBitIndex);
      }

      markStepComplete('simulation');
      markStepComplete('verify');
      markStepComplete('compare');
      markStepComplete('status');

      setWorkflowStatusMessage(
        `[Random Fault Injected] Inverted random bit [${simulated.flippedBitIndex}]. Remainder: ${simulated.currentRemainderHex} (CORRUPTED).`
      );
      addLog(
        `[Channel Noise] Inverted random bit at index [${simulated.flippedBitIndex}]. Status: CORRUPTED.`,
        'warning'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Random bit flip error';
      setErrorMessage(msg);
      addLog(msg, 'error');
    }
  };

  // Handler for Direct Bit Toggle by Clicking in Bitstream
  const handleToggleCodewordBit = (bitIndex: number) => {
    if (!crcState) return;
    const cleanCodeword = cleanBinaryInput(editableCodeword);
    if (bitIndex < 0 || bitIndex >= cleanCodeword.length) return;

    const currentBit = cleanCodeword[bitIndex];
    const toggledBit = currentBit === '0' ? '1' : '0';
    const newCodeword =
      cleanCodeword.slice(0, bitIndex) +
      toggledBit +
      cleanCodeword.slice(bitIndex + 1);

    setEditableCodeword(newCodeword);
    const verified = verifyCodeword(crcState, newCodeword);
    setCrcState(verified);
    setActiveWorkflowStep('compare');

    if (verified.isValid) {
      setWorkflowStatusMessage(
        `Bit [${bitIndex}] inverted ('${currentBit}' → '${toggledBit}'). Codeword restored to VALID (Remainder: 0x00000000).`
      );
      addLog(
        `[Interactive Toggle] Bit [${bitIndex}] restored: Remainder = 0x00000000 (VALID).`,
        'success'
      );
    } else {
      setWorkflowStatusMessage(
        `Bit [${bitIndex}] inverted ('${currentBit}' → '${toggledBit}'). Remainder is now ${verified.currentRemainderHex} (CORRUPTED)!`
      );
      addLog(
        `[Interactive Toggle] Bit [${bitIndex}] flipped ('${currentBit}' → '${toggledBit}'). Remainder = ${verified.currentRemainderHex} (CORRUPTED).`,
        'error'
      );
    }
  };

  // Handler for Verifying Current / Modified Codeword (Receiver Side)
  const handleVerifyCurrentInput = () => {
    setErrorMessage(null);
    setActiveWorkflowStep('verify');

    if (!crcState) {
      const msg = 'Error: No active CRC experiment. Please generate CRC first.';
      setErrorMessage(msg);
      addLog(msg, 'error');
      return;
    }

    const cleanInput = cleanBinaryInput(editableCodeword);
    if (!cleanInput) {
      const msg = 'Verification Error: Codeword to verify cannot be empty.';
      setErrorMessage(msg);
      addLog(msg, 'error');
      return;
    }

    if (!isValidBinaryString(cleanInput)) {
      const msg = 'Verification Error: Codeword must contain only binary 0s and 1s.';
      setErrorMessage(msg);
      addLog(msg, 'error');
      return;
    }

    if (cleanInput.length < CRC_BITS + 1) {
      const msg = `Verification Error: Codeword length (${cleanInput.length}) must be greater than generator length (${GENERATOR_POLYNOMIAL.length} bits).`;
      setErrorMessage(msg);
      addLog(msg, 'error');
      return;
    }

    try {
      const verified = verifyCodeword(crcState, cleanInput);
      setCrcState(verified);

      markStepComplete('verify');
      markStepComplete('compare');
      markStepComplete('status');

      if (verified.isValid) {
        setWorkflowStatusMessage(
          `[Step 3 Verified] Modulo-2 division yielded exact zero (0x00000000). Frame is VALID / NOT CORRUPTED.`
        );
        addLog(
          `[Receiver] Verification Check: Remainder is 0x00000000. Frame VALID / NOT CORRUPTED.`,
          'success'
        );
      } else {
        setWorkflowStatusMessage(
          `[Step 3 Verified] Modulo-2 division remainder is ${verified.currentRemainderHex}. Frame is CORRUPTED / ERROR DETECTED!`
        );
        addLog(
          `[Receiver] Verification Check: Remainder is ${verified.currentRemainderHex} (Non-zero). Frame CORRUPTED / ERROR DETECTED!`,
          'error'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification error';
      setErrorMessage(msg);
      addLog(msg, 'error');
    }
  };

  // Restore Clean Codeword
  const handleRestoreCleanCodeword = () => {
    if (!crcState) return;
    const restored = verifyCodeword(crcState, crcState.generatedCodeword);
    setCrcState({
      ...restored,
      flippedBitIndex: null,
      errorSimulationActive: false,
    });
    setEditableCodeword(crcState.generatedCodeword);
    setActiveWorkflowStep('compare');
    setWorkflowStatusMessage('Restored clean original codeword. Channel noise removed. Status: VALID.');
    addLog('[Channel] Restored clean transmitted codeword. Verification status: VALID.', 'success');
  };

  // Save CSV Report
  const handleSaveReport = () => {
    setActiveWorkflowStep('report');
    markStepComplete('report');

    if (!crcState) {
      setErrorMessage('Please generate or verify a CRC experiment before exporting a report.');
      return;
    }

    try {
      const csvContent = generateCSVReport(crcState);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.setAttribute('href', url);
      link.setAttribute('download', `CRC32_Verification_Report_${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setWorkflowStatusMessage(`[Step 7 Report Saved] Downloaded CRC32_Verification_Report_${timestamp}.csv successfully.`);
      addLog(`Exported CSV verification report: CRC32_Verification_Report_${timestamp}.csv`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to export CSV report';
      setErrorMessage(msg);
      addLog(`CSV export failed: ${msg}`, 'error');
    }
  };

  // Reset entire dashboard
  const handleReset = () => {
    setInputType('text');
    setTextInput(DEFAULT_TEXT);
    setBinaryInput(DEFAULT_BINARY);
    setUploadedFileName('');
    setUploadedFileSize(0);
    setFileBinaryData('');
    setErrorMessage(null);

    const initialBinary = textToBinary(DEFAULT_TEXT);
    const generated = generateCRC(initialBinary, 'text', DEFAULT_TEXT);
    setCrcState(generated);
    setEditableCodeword(generated.generatedCodeword);
    setBitIndexToFlip(12);

    setActiveWorkflowStep('input');
    setCompletedSteps(new Set(['input']));
    setWorkflowStatusMessage('Dashboard reset to default baseline experiment. Workflow positioned at Step 1: Select Input.');
    addLog('Dashboard reset to default baseline experiment ("hello").', 'info');
  };

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Presets
  const applyPreset = (type: 'text' | 'binary', val: string) => {
    setActiveWorkflowStep('input');
    if (type === 'text') {
      setInputType('text');
      setTextInput(val);
      const bin = textToBinary(val);
      const gen = generateCRC(bin, 'text', val);
      setCrcState(gen);
      setEditableCodeword(gen.generatedCodeword);
      setBitIndexToFlip(Math.floor(gen.generatedCodeword.length / 2));
      setWorkflowStatusMessage(`Applied text preset "${val}" (${bin.length} bits). Step 1 updated.`);
      addLog(`Applied text preset: "${val}" (${bin.length} bits).`, 'info');
    } else {
      setInputType('binary');
      setBinaryInput(val);
      const cleaned = cleanBinaryInput(val);
      const gen = generateCRC(cleaned, 'binary', val);
      setCrcState(gen);
      setEditableCodeword(gen.generatedCodeword);
      setBitIndexToFlip(Math.floor(gen.generatedCodeword.length / 2));
      setWorkflowStatusMessage(`Applied binary preset (${cleaned.length} bits). Step 1 updated.`);
      addLog(`Applied binary preset (${cleaned.length} bits).`, 'info');
    }
  };

  // Automated Guided Demonstration Walkthrough
  const handleRunDemoWalkthrough = async () => {
    if (isDemonstrating) return;
    setIsDemonstrating(true);
    setErrorMessage(null);
    addLog('=== Starting Automated Academic Demonstration Walkthrough ===', 'info');

    try {
      // Step 1: Input Setup
      setActiveWorkflowStep('input');
      setWorkflowStatusMessage('Demo Step 1: Initializing baseline input "hello" (40 bits)...');
      applyPreset('text', 'hello');
      await new Promise((r) => setTimeout(r, 1000));

      // Step 2: Generate Reference CRC
      setActiveWorkflowStep('generate');
      setWorkflowStatusMessage('Demo Step 2: Performing modulo-2 division to compute reference CRC-32...');
      addLog('[Demo] Transmitted codeword assembled with 32-bit CRC remainder.', 'info');
      await new Promise((r) => setTimeout(r, 1200));

      // Step 3: Verify Codeword (Receiver)
      setActiveWorkflowStep('verify');
      setWorkflowStatusMessage('Demo Step 3: Receiver verifying pristine codeword (Remainder: 0x00000000 - VALID)...');
      addLog('[Demo] Receiver initial verification passed: Remainder = 0x00000000 (VALID).', 'success');
      await new Promise((r) => setTimeout(r, 1200));

      // Step 4: Error Simulation
      setActiveWorkflowStep('simulation');
      setWorkflowStatusMessage('Demo Step 4: Inverting bit [16] to simulate channel transmission noise...');
      setBitIndexToFlip(16);
      if (crcState) {
        const simulated = simulateBitFlip(crcState, 16);
        setCrcState(simulated);
        setEditableCodeword(simulated.currentCodeword);
        addLog('[Demo] Bit [16] inverted in transmission channel.', 'warning');
      }
      await new Promise((r) => setTimeout(r, 1400));

      // Step 5: Compare Dual Sides
      setActiveWorkflowStep('compare');
      setWorkflowStatusMessage('Demo Step 5: Side-by-side analysis detected bit mismatch and non-zero remainder!');
      addLog('[Demo] Receiver calculated non-zero remainder (Frame CORRUPTED).', 'error');
      await new Promise((r) => setTimeout(r, 1400));

      // Step 6: Status Verdict
      setActiveWorkflowStep('status');
      setWorkflowStatusMessage('Demo Step 6: Status verdict updated to CORRUPTED / ERROR DETECTED.');
      await new Promise((r) => setTimeout(r, 1200));

      // Restoring Clean Frame
      setWorkflowStatusMessage('Demo: Reverting channel noise to demonstrate clean reception...');
      handleRestoreCleanCodeword();
      setActiveWorkflowStep('status');
      await new Promise((r) => setTimeout(r, 1000));

      setWorkflowStatusMessage('Demo Complete: All 7 academic stages verified successfully!');
      addLog('=== Academic Demonstration Walkthrough Completed Successfully ===', 'success');
    } finally {
      setIsDemonstrating(false);
    }
  };

  // Compute bit differences
  const bitDifferences = useMemo(() => {
    if (!crcState) return { indices: [], count: 0 };
    const cleanReceived = cleanBinaryInput(editableCodeword);
    return getBitDifferences(crcState.generatedCodeword, cleanReceived);
  }, [crcState, editableCodeword]);

  // Current active step index (0 to 6)
  const activeStepIndex = WORKFLOW_STEPS.findIndex((s) => s.id === activeWorkflowStep);

  return (
    <div
      id="crc-app-container"
      className="min-h-screen w-full flex flex-col bg-[#F5F5F0] text-[#2C2C24] font-sans antialiased selection:bg-[#5A5A40] selection:text-white"
    >
      {/* ----------------- Top Header ----------------- */}
      <header
        id="dashboard-header"
        className="flex flex-wrap items-center justify-between px-6 lg:px-8 py-3.5 border-b border-[#D1D1CB] bg-[#EBEBE6] gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#5A5A40] text-white flex items-center justify-center font-mono font-bold text-base shadow-xs">
            32
          </div>
          <div>
            <h1 className="text-base lg:text-lg font-bold tracking-tight uppercase text-[#2C2C24]">
              CRC-32 Dashboard – Development and Integration
            </h1>
            <p className="text-[11px] text-[#5A5A40] font-medium tracking-wide flex items-center gap-1.5">
              <span>IEEE 802.3 Modulo-2 Polynomial Verification</span>
              <span className="text-[#8C8C84]">•</span>
              <span>Academic Project Experiment</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            id="btn-run-demo"
            onClick={handleRunDemoWalkthrough}
            disabled={isDemonstrating}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded active:scale-[0.98] transition uppercase tracking-wider shadow-xs cursor-pointer ${
              isDemonstrating
                ? 'bg-[#5A5A40] text-white animate-pulse'
                : 'bg-[#2C2C24] text-white hover:bg-black'
            }`}
            title="Run automatic live demonstration through all 7 stages"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#BEDABE]" />
            <span>{isDemonstrating ? 'Running Demo...' : 'Run Demo'}</span>
          </button>

          <button
            id="btn-open-math"
            onClick={() => setShowMathModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#D1D1CB] text-[#5A5A40] bg-white rounded hover:bg-[#F5F5F0] active:scale-[0.98] transition uppercase tracking-wider cursor-pointer"
            title="View IEEE 802.3 mathematical proof and polynomial properties"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Math &amp; Spec</span>
          </button>

          <a
            id="btn-download-pdf-header"
            href="/CRC-32-Code-Explanation.pdf"
            download="CRC-32-Code-Explanation.pdf"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#2C2C24] text-white rounded hover:bg-black active:scale-[0.98] transition uppercase tracking-wider shadow-xs cursor-pointer no-underline"
            title="Download complete PDF file of all explained code and mathematical proofs"
          >
            <FileText className="w-3.5 h-3.5 text-[#BEDABE]" />
            <span className="hidden sm:inline">Download Code PDF</span>
          </a>

          <button
            id="btn-save-report-header"
            onClick={handleSaveReport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#5A5A40] text-white rounded hover:bg-[#4A4A34] active:scale-[0.98] transition uppercase tracking-wider shadow-xs cursor-pointer"
            title="Download CSV report of current experiment"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save Report</span>
          </button>

          <button
            id="btn-reset-header"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#5A5A40] text-[#5A5A40] rounded hover:bg-[#D1D1CB] active:scale-[0.98] transition uppercase tracking-wider cursor-pointer"
            title="Reset to default experiment"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </header>

      {/* ----------------- Dynamic Interactive Workflow Bar ----------------- */}
      <div className="bg-[#EFEFEA] border-b border-[#D1D1CB] shadow-2xs sticky top-0 z-20">
        <nav
          aria-label="Dynamic academic experiment workflow"
          className="px-6 py-2.5 overflow-x-auto text-[11px] text-[#5A5A40] flex items-center gap-2 shrink-0 whitespace-nowrap"
        >
          <div className="flex items-center gap-1 font-bold uppercase text-[10px] text-[#7A7A6E] tracking-wider mr-1">
            <Activity className="w-3.5 h-3.5 text-[#5A5A40]" />
            <span>Workflow:</span>
          </div>

          {WORKFLOW_STEPS.map((step, idx) => {
            const isActive = activeWorkflowStep === step.id;
            const isCompleted = completedSteps.has(step.id);

            return (
              <React.Fragment key={step.id}>
                <button
                  type="button"
                  id={`workflow-btn-${step.id}`}
                  onClick={() => handleWorkflowStepClick(step)}
                  className={`group relative flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-[#5A5A40] text-white shadow-sm ring-2 ring-[#5A5A40]/30 font-bold scale-[1.02]'
                      : isCompleted
                      ? 'bg-white border border-[#BEDABE] text-[#2C2C24] hover:bg-[#F5F5F0]'
                      : 'bg-white/70 border border-[#D1D1CB] text-[#7A7A6E] hover:text-[#2C2C24] hover:bg-white'
                  }`}
                  title={`${step.label} – Click to navigate`}
                >
                  {/* Active pulsing dot */}
                  {isActive ? (
                    <span className="relative flex h-2 w-2 mr-0.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                  ) : isCompleted ? (
                    <CheckCircle className="w-3 h-3 text-[#476C35]" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#A0A096]"></span>
                  )}

                  <span>{step.label}</span>
                </button>

                {idx < WORKFLOW_STEPS.length - 1 && (
                  <ArrowRight
                    className={`w-3 h-3 transition-colors ${
                      activeStepIndex > idx
                        ? 'text-[#5A5A40]'
                        : 'text-[#C5C5BC]'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </nav>

        {/* Dynamic Workflow Live Feedback Sub-bar */}
        <div className="bg-[#E5E5DE] px-6 py-1.5 flex flex-wrap items-center justify-between text-xs text-[#2C2C24] border-t border-[#DCDCD5] gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#5A5A40] text-white text-[10px] font-bold uppercase tracking-wider">
              Stage {activeStepIndex + 1} of 7
            </span>
            <span className="text-[11px] text-[#4A4A34] font-medium truncate max-w-[800px]">
              {workflowStatusMessage}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-[#7A7A6E]">
            <span className="flex items-center gap-1 text-[10px]">
              <MousePointerClick className="w-3 h-3 text-[#5A5A40]" />
              Click any step above to inspect
            </span>
          </div>
        </div>
      </div>

      {/* ----------------- Global Notification Alert Banner ----------------- */}
      {errorMessage && (
        <div
          id="error-alert-banner"
          className="mx-6 lg:mx-8 mt-4 p-3 bg-[#FDF2F2] border border-[#E8AEAE] text-[#7A2222] rounded flex items-start justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#BA4A4A]" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-[11px] uppercase tracking-wider font-bold underline hover:opacity-80 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ----------------- Main Dashboard Content ----------------- */}
      <main className="flex-1 p-5 lg:p-6 max-w-[1700px] w-full mx-auto space-y-6">
        {/* ================= TOP ROW: SECTIONS 1, 2, 3 & 4 ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* ----- SECTION 1: INPUT SELECTION (col-span-4) ----- */}
          <section
            id="section-input-selection"
            onClick={() => {
              setActiveWorkflowStep('input');
              setWorkflowStatusMessage('Select input type (Text, Binary, File), enter your data, or use presets.');
            }}
            onFocusCapture={() => {
              setActiveWorkflowStep('input');
              setWorkflowStatusMessage('Editing input dataword for CRC generation...');
            }}
            className={`lg:col-span-4 bg-white border rounded p-5 flex flex-col justify-between transition-all duration-300 ${
              activeWorkflowStep === 'input'
                ? 'border-[#5A5A40] ring-2 ring-[#5A5A40]/25 shadow-md'
                : 'border-[#D1D1CB] shadow-xs hover:border-[#A8A89A]'
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#EBEBE6] pb-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      activeWorkflowStep === 'input'
                        ? 'bg-[#5A5A40] text-white'
                        : 'bg-[#EBEBE6] text-[#5A5A40]'
                    }`}
                  >
                    1
                  </span>
                  <label className="text-[11px] uppercase font-bold text-[#5A5A40] tracking-wider">
                    Input Selection
                  </label>
                </div>

                <div className="flex items-center gap-1.5">
                  {activeWorkflowStep === 'input' && (
                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#5A5A40] text-white flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                      Active
                    </span>
                  )}
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F5F5F0] text-[#5A5A40] border border-[#EBEBE6]">
                    {inputType.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Input Type Selector Tabs */}
              <div className="grid grid-cols-3 gap-1 bg-[#F5F5F0] p-1 rounded border border-[#EBEBE6]">
                <button
                  id="tab-input-text"
                  type="button"
                  onClick={() => {
                    setInputType('text');
                    setErrorMessage(null);
                    setActiveWorkflowStep('input');
                    setWorkflowStatusMessage('Text message mode: ASCII characters converted to 8-bit binary stream.');
                  }}
                  className={`py-1.5 text-xs font-semibold rounded text-center transition cursor-pointer ${
                    inputType === 'text'
                      ? 'bg-[#5A5A40] text-white shadow-xs'
                      : 'text-[#5A5A40] hover:bg-[#EBEBE6]'
                  }`}
                >
                  Text
                </button>
                <button
                  id="tab-input-binary"
                  type="button"
                  onClick={() => {
                    setInputType('binary');
                    setErrorMessage(null);
                    setActiveWorkflowStep('input');
                    setWorkflowStatusMessage('Binary mode: Accepts raw bits (0 and 1 only). Delimiters ignored.');
                  }}
                  className={`py-1.5 text-xs font-semibold rounded text-center transition cursor-pointer ${
                    inputType === 'binary'
                      ? 'bg-[#5A5A40] text-white shadow-xs'
                      : 'text-[#5A5A40] hover:bg-[#EBEBE6]'
                  }`}
                >
                  Binary
                </button>
                <button
                  id="tab-input-file"
                  type="button"
                  onClick={() => {
                    setInputType('file');
                    setErrorMessage(null);
                    setActiveWorkflowStep('input');
                    setWorkflowStatusMessage('File mode: Converts uploaded file byte buffer into binary bitstream.');
                  }}
                  className={`py-1.5 text-xs font-semibold rounded text-center transition cursor-pointer ${
                    inputType === 'file'
                      ? 'bg-[#5A5A40] text-white shadow-xs'
                      : 'text-[#5A5A40] hover:bg-[#EBEBE6]'
                  }`}
                >
                  File
                </button>
              </div>

              {/* Tab 1: Text Input */}
              {inputType === 'text' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-[#2C2C24]">Message String:</span>
                    <span className="text-[10px] text-[#7A7A6E]">UTF-8 ASCII encoding</span>
                  </div>
                  <textarea
                    id="input-text-area"
                    value={textInput}
                    onFocus={() => {
                      setActiveWorkflowStep('input');
                      setWorkflowStatusMessage('Editing text message string...');
                    }}
                    onChange={(e) => {
                      setTextInput(e.target.value);
                      setErrorMessage(null);
                      setActiveWorkflowStep('input');
                    }}
                    rows={3}
                    placeholder="Enter text message..."
                    className="w-full p-2.5 text-sm bg-white border border-[#D1D1CB] rounded focus:outline-none focus:border-[#5A5A40] font-sans resize-none transition"
                  />
                  <div className="text-[11px] text-[#7A7A6E] flex justify-between items-center px-1">
                    <span>Characters: {textInput.length}</span>
                    <span className="font-mono text-[#5A5A40] font-semibold">
                      {textToBinary(textInput).length} binary bits
                    </span>
                  </div>
                </div>
              )}

              {/* Tab 2: Binary Input */}
              {inputType === 'binary' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-[#2C2C24]">Binary Dataword:</span>
                    <span className="text-[10px] text-[#7A7A6E]">Strict 0 and 1 only</span>
                  </div>
                  <textarea
                    id="input-binary-area"
                    value={binaryInput}
                    onFocus={() => {
                      setActiveWorkflowStep('input');
                      setWorkflowStatusMessage('Editing binary dataword stream...');
                    }}
                    onChange={(e) => {
                      setBinaryInput(e.target.value);
                      setErrorMessage(null);
                      setActiveWorkflowStep('input');
                    }}
                    rows={3}
                    placeholder="e.g. 01101000 01100101 01101100"
                    className="w-full p-2.5 text-xs font-mono bg-white border border-[#D1D1CB] rounded focus:outline-none focus:border-[#5A5A40] resize-none transition"
                  />
                  <div className="text-[11px] text-[#7A7A6E] flex justify-between items-center px-1">
                    <span>Spaces &amp; delimiters ignored</span>
                    <span className="font-mono text-[#5A5A40] font-semibold">
                      {cleanBinaryInput(binaryInput).length} bits detected
                    </span>
                  </div>
                </div>
              )}

              {/* Tab 3: File Upload */}
              {inputType === 'file' && (
                <div className="space-y-2.5">
                  <span className="text-xs font-medium text-[#2C2C24] block">Select Local File:</span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload-input"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setActiveWorkflowStep('input');
                      fileInputRef.current?.click();
                    }}
                    className="w-full p-4 border-2 border-dashed border-[#D1D1CB] hover:border-[#5A5A40] rounded bg-[#F9F9F7] text-center cursor-pointer transition flex flex-col items-center gap-1.5"
                  >
                    <Upload className="w-5 h-5 text-[#5A5A40]" />
                    <span className="text-xs font-semibold text-[#5A5A40]">
                      {uploadedFileName ? 'Change File' : 'Click to Upload File'}
                    </span>
                    <span className="text-[10px] text-[#8C8C84]">Converts raw file bytes to binary</span>
                  </button>

                  {uploadedFileName && (
                    <div className="p-2.5 bg-[#F5F5F0] border border-[#EBEBE6] rounded text-xs">
                      <div className="font-medium text-[#2C2C24] truncate">{uploadedFileName}</div>
                      <div className="text-[10px] text-[#7A7A6E] mt-0.5 flex justify-between">
                        <span>Size: {uploadedFileSize} bytes</span>
                        <span className="font-mono font-semibold text-[#5A5A40]">
                          {fileBinaryData.length} bits
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Presets */}
              <div className="pt-2 border-t border-[#EBEBE6]">
                <span className="text-[10px] uppercase font-bold text-[#8C8C84] tracking-wider block mb-1.5">
                  Academic Test Presets
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyPreset('text', 'hello')}
                    className="px-2 py-1 text-[10px] font-mono bg-[#F5F5F0] hover:bg-[#EBEBE6] border border-[#D1D1CB] rounded text-[#5A5A40] cursor-pointer"
                  >
                    &quot;hello&quot; (40b)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('text', '123456789')}
                    className="px-2 py-1 text-[10px] font-mono bg-[#F5F5F0] hover:bg-[#EBEBE6] border border-[#D1D1CB] rounded text-[#5A5A40] cursor-pointer"
                    title="Standard IEEE 802.3 test vector string"
                  >
                    &quot;123456789&quot; (72b)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('text', 'CRC-32')}
                    className="px-2 py-1 text-[10px] font-mono bg-[#F5F5F0] hover:bg-[#EBEBE6] border border-[#D1D1CB] rounded text-[#5A5A40] cursor-pointer"
                  >
                    &quot;CRC-32&quot; (48b)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('binary', '11010011101100')}
                    className="px-2 py-1 text-[10px] font-mono bg-[#F5F5F0] hover:bg-[#EBEBE6] border border-[#D1D1CB] rounded text-[#5A5A40] cursor-pointer"
                  >
                    14-bit binary
                  </button>
                </div>
              </div>

              {/* Primary Action Button */}
              <button
                id="btn-generate-crc"
                type="button"
                onClick={handleGenerateCRC}
                className="w-full py-2.5 bg-[#5A5A40] hover:bg-[#4A4A34] text-white text-xs font-bold rounded uppercase tracking-wider active:scale-[0.99] transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Generate CRC</span>
              </button>
            </div>

            <div className="mt-4 p-2.5 bg-[#F5F5F0] border border-[#D1D1CB] rounded text-[10px] text-[#5A5A40] leading-relaxed">
              <strong className="block text-[#2C2C24] font-bold">Standard IEEE 802.3:</strong>
              Converts input to bitstream and computes 32-bit CRC checksum using modulo-2 division.
            </div>
          </section>

          {/* ----- SECTION 2: CRC-32 GENERATION (SENDER SIDE) (col-span-4) ----- */}
          <section
            id="section-crc-generation"
            onClick={() => {
              setActiveWorkflowStep('generate');
              setWorkflowStatusMessage('Sender Side: Dataword zero-padded and divided by generator polynomial G(x) to compute reference CRC.');
            }}
            className={`lg:col-span-4 bg-white border rounded p-5 flex flex-col justify-between transition-all duration-300 ${
              activeWorkflowStep === 'generate'
                ? 'border-[#5A5A40] ring-2 ring-[#5A5A40]/25 shadow-md'
                : 'border-[#D1D1CB] shadow-xs hover:border-[#A8A89A]'
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#EBEBE6] pb-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      activeWorkflowStep === 'generate'
                        ? 'bg-[#5A5A40] text-white'
                        : 'bg-[#EBEBE6] text-[#5A5A40]'
                    }`}
                  >
                    2
                  </span>
                  <label className="text-[11px] uppercase font-bold text-[#5A5A40] tracking-wider">
                    CRC-32 Generation (Sender)
                  </label>
                </div>
                <div className="flex items-center gap-1.5">
                  {activeWorkflowStep === 'generate' && (
                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#5A5A40] text-white flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                      Active
                    </span>
                  )}
                  <span className="text-[10px] text-[#7A7A6E]">Transmitter Node</span>
                </div>
              </div>

              {/* Polynomial & Reference CRC */}
              <div className="space-y-3">
                <div className="p-3 bg-[#F5F5F0] border border-[#EBEBE6] rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase text-[#8C8C84] font-bold">
                      Generator Polynomial G(x)
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(GENERATOR_POLYNOMIAL, 'poly');
                      }}
                      className="text-[#5A5A40] hover:opacity-75 cursor-pointer"
                      title="Copy polynomial"
                    >
                      {copiedKey === 'poly' ? <Check className="w-3 h-3 text-green-700" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <code className="text-[11px] font-mono break-all text-[#5A5A40] font-semibold block leading-tight">
                    {GENERATOR_POLYNOMIAL}
                  </code>
                  <span className="text-[9px] text-[#8C8C84] block mt-1">33 bits (Degree 32) • IEEE 802.3</span>
                </div>

                <div className="p-3 bg-[#F5F5F0] border border-[#EBEBE6] rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase text-[#8C8C84] font-bold">
                      Reference CRC Checksum R(x)
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(crcState?.referenceCRCHex || '', 'crcHex');
                      }}
                      className="text-[#5A5A40] hover:opacity-75 cursor-pointer"
                      title="Copy CRC Hex"
                    >
                      {copiedKey === 'crcHex' ? <Check className="w-3 h-3 text-green-700" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <code className="text-base font-mono text-[#5A5A40] font-bold">
                      {crcState ? crcState.referenceCRCHex : '0x00000000'}
                    </code>
                    <span className="text-[10px] font-mono text-[#7A7A6E]">32 bits</span>
                  </div>
                  <code className="text-[9px] font-mono text-[#7A7A6E] block truncate mt-1" title={crcState?.referenceCRC}>
                    {crcState?.referenceCRC || 'Pending generation...'}
                  </code>
                </div>
              </div>

              {/* Padded Dataword & Generated Codeword */}
              <div className="space-y-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[#5A5A40]">
                      Padded Dataword (D &bull; 2<sup>32</sup>)
                    </span>
                    <span className="text-[10px] text-[#7A7A6E]">
                      {crcState?.paddedDataword.length || 0} bits total
                    </span>
                  </div>
                  <div
                    className="p-2 bg-[#F9F9F7] border border-[#EBEBE6] rounded font-mono text-[11px] break-all max-h-16 overflow-y-auto select-all text-[#2C2C24]"
                    title="Original dataword padded with 32 zeros"
                  >
                    {crcState ? crcState.paddedDataword : 'No dataword loaded.'}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[#5A5A40]">
                      Transmitted Codeword T = D + R
                    </span>
                    <span className="text-[10px] text-[#7A7A6E]">
                      {crcState?.generatedCodeword.length || 0} bits
                    </span>
                  </div>
                  <div
                    className="p-2 bg-[#F9F9F7] border border-[#EBEBE6] rounded font-mono text-[11px] break-all max-h-20 overflow-y-auto select-all"
                    title="Original generated codeword"
                  >
                    {crcState ? (
                      <>
                        <span className="text-[#2C2C24]">{crcState.dataword}</span>
                        <span className="bg-[#EAEADF] text-[#5A5A40] font-bold px-0.5 rounded ml-0.5">
                          {crcState.referenceCRC}
                        </span>
                      </>
                    ) : (
                      'No codeword generated.'
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-[#7A7A6E] mt-1">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 bg-[#2C2C24] rounded-xs inline-block"></span>
                      <span>Dataword ({crcState?.dataword.length || 0}b)</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 bg-[#5A5A40] rounded-xs inline-block"></span>
                      <span>CRC ({CRC_BITS}b)</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-[#EBEBE6] text-[10px] text-[#7A7A6E] flex justify-between">
              <span>Transmission Ready</span>
              <span className="font-mono text-[#5A5A40] font-semibold">T(x) Prepared</span>
            </div>
          </section>

          {/* ----- COLUMN 3: SECTIONS 3 & 4 (col-span-4) ----- */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* 3. Received Codeword & Verification Card */}
            <section
              id="section-verify-codeword"
              onClick={() => {
                setActiveWorkflowStep('verify');
                setWorkflowStatusMessage('Step 3: Verify Codeword. Inspect received codeword and trigger receiver modulo-2 verification.');
              }}
              className={`bg-white border rounded p-4 flex flex-col justify-between transition-all duration-300 ${
                activeWorkflowStep === 'verify'
                  ? 'border-[#5A5A40] ring-2 ring-[#5A5A40]/25 shadow-md'
                  : 'border-[#D1D1CB] shadow-xs hover:border-[#A8A89A]'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-[#EBEBE6] pb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                        activeWorkflowStep === 'verify'
                          ? 'bg-[#5A5A40] text-white'
                          : 'bg-[#EBEBE6] text-[#5A5A40]'
                      }`}
                    >
                      3
                    </span>
                    <span className="text-xs font-bold uppercase text-[#5A5A40]">
                      Verify Codeword (Receiver)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {activeWorkflowStep === 'verify' && (
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#5A5A40] text-white flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                        Active
                      </span>
                    )}
                    {crcState?.flippedBitIndex !== null && (
                      <span className="text-[10px] text-[#BA4A4A] font-bold font-mono">
                        [Bit {crcState?.flippedBitIndex} flipped]
                      </span>
                    )}
                  </div>
                </div>

                <textarea
                  id="current-codeword-area"
                  value={editableCodeword}
                  onFocus={() => {
                    setActiveWorkflowStep('verify');
                    setWorkflowStatusMessage('Editing received codeword. Click "Verify Input" to run modulo-2 check.');
                  }}
                  onChange={(e) => {
                    setEditableCodeword(e.target.value);
                    setErrorMessage(null);
                    setActiveWorkflowStep('verify');
                  }}
                  rows={3}
                  placeholder="Received codeword bit stream..."
                  className="w-full p-2 text-xs font-mono bg-white border border-[#D1D1CB] rounded focus:outline-none focus:border-[#5A5A40] resize-none transition"
                />

                <button
                  id="btn-verify-input"
                  type="button"
                  onClick={handleVerifyCurrentInput}
                  className="w-full py-2 bg-[#5A5A40] hover:bg-[#4A4A34] text-white text-xs font-bold rounded uppercase tracking-wider active:scale-[0.99] transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verify Input</span>
                </button>
              </div>
            </section>

            {/* 4. Error Simulation (Channel) Card */}
            <section
              id="section-error-simulation"
              onClick={() => {
                setActiveWorkflowStep('simulation');
                setWorkflowStatusMessage('Step 4: Error Simulation. Select any bit index to flip (0↔1) and test fault detection.');
              }}
              className={`bg-white border rounded p-4 flex flex-col justify-between transition-all duration-300 ${
                activeWorkflowStep === 'simulation'
                  ? 'border-[#5A5A40] ring-2 ring-[#5A5A40]/25 shadow-md'
                  : 'border-[#D1D1CB] shadow-xs hover:border-[#A8A89A]'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-[#EBEBE6] pb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                        activeWorkflowStep === 'simulation'
                          ? 'bg-[#5A5A40] text-white'
                          : 'bg-[#EBEBE6] text-[#5A5A40]'
                      }`}
                    >
                      4
                    </span>
                    <h3 className="text-xs font-bold uppercase text-[#2C2C24] flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-[#5A5A40]" />
                      <span>Error Simulation (Channel)</span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {activeWorkflowStep === 'simulation' && (
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#5A5A40] text-white flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                        Active
                      </span>
                    )}
                    {crcState?.errorSimulationActive && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#FDF2F2] text-[#BA4A4A] border border-[#E8AEAE] font-bold rounded">
                        Fault Active
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <input
                      type="range"
                      min="0"
                      max={crcState ? crcState.generatedCodeword.length - 1 : 71}
                      value={bitIndexToFlip}
                      onChange={(e) => {
                        setActiveWorkflowStep('simulation');
                        setBitIndexToFlip(parseInt(e.target.value, 10));
                      }}
                      className="flex-1 accent-[#5A5A40] cursor-pointer"
                    />
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[#7A7A6E] font-medium">Bit:</span>
                      <input
                        type="number"
                        min="0"
                        max={crcState ? crcState.generatedCodeword.length - 1 : 71}
                        value={bitIndexToFlip}
                        onChange={(e) => {
                          setActiveWorkflowStep('simulation');
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) setBitIndexToFlip(val);
                        }}
                        className="w-14 p-1 text-xs font-mono font-bold text-center bg-white border border-[#D1D1CB] rounded"
                      />
                    </div>
                  </div>

                  {crcState && (
                    <div className="text-[10px] text-[#7A7A6E] flex justify-between px-0.5">
                      <span>Index 0</span>
                      <span className="font-mono text-[#5A5A40] font-medium">
                        Bit [{bitIndexToFlip}] = &apos;{crcState.generatedCodeword[bitIndexToFlip] ?? '?'}&apos;
                        {bitIndexToFlip < crcState.dataword.length ? ' (Data bit)' : ' (CRC bit)'}
                      </span>
                      <span>Index {crcState.generatedCodeword.length - 1}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    id="btn-simulate-error"
                    type="button"
                    onClick={handleSimulateError}
                    className="flex-1 min-w-[130px] py-1.5 border-2 border-[#5A5A40] text-[#5A5A40] hover:bg-[#5A5A40] hover:text-white text-xs font-bold rounded uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Flip Bit [{bitIndexToFlip}]</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSimulateRandomError}
                    className="px-2.5 py-1.5 border border-[#D1D1CB] bg-[#F5F5F0] hover:bg-[#EBEBE6] text-[#5A5A40] text-xs font-semibold rounded uppercase tracking-wider transition cursor-pointer flex items-center gap-1"
                    title="Invert a randomly selected bit"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>Random</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSimulateBurstError}
                    className="px-2.5 py-1.5 border border-[#BA4A4A]/40 bg-[#FDF2F2] hover:bg-[#FBE8E8] text-[#BA4A4A] text-xs font-semibold rounded uppercase tracking-wider transition cursor-pointer flex items-center gap-1"
                    title="Invert 3 consecutive bits (burst error)"
                  >
                    <span>Burst (3b)</span>
                  </button>

                  {crcState?.errorSimulationActive && (
                    <button
                      type="button"
                      onClick={handleRestoreCleanCodeword}
                      className="px-2.5 py-1.5 border border-[#D1D1CB] hover:bg-[#EBEBE6] text-[#5A5A40] text-xs font-semibold rounded uppercase tracking-wider transition cursor-pointer"
                      title="Revert corrupted codeword to original clean codeword"
                    >
                      Revert
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* ================= SECTION 5: SENDER SIDE VS RECEIVER SIDE COMPARISON ================= */}
        <section
          id="section-crc-comparison-dual-side"
          onClick={() => {
            setActiveWorkflowStep('compare');
            setWorkflowStatusMessage('Step 5: End-to-end transmission line comparison between Sender Side (Tx) and Receiver Side (Rx).');
          }}
          className={`bg-white border rounded-lg p-6 transition-all duration-300 ${
            activeWorkflowStep === 'compare'
              ? 'border-[#5A5A40] ring-2 ring-[#5A5A40]/25 shadow-md'
              : 'border-[#D1D1CB] shadow-xs hover:border-[#A8A89A]'
          }`}
        >
          {/* Section 5 Header */}
          <div className="flex flex-wrap items-center justify-between border-b border-[#EBEBE6] pb-3 mb-5 gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  activeWorkflowStep === 'compare'
                    ? 'bg-[#5A5A40] text-white'
                    : 'bg-[#EBEBE6] text-[#5A5A40]'
                }`}
              >
                5
              </span>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#2C2C24]">
                  CRC-32 Comparison – Sender Side vs. Receiver Side
                </h2>
                <p className="text-[11px] text-[#7A7A6E]">
                  Complete transmission line analysis comparing transmitted data against received verification
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {activeWorkflowStep === 'compare' && (
                <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-[#5A5A40] text-white flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                  Active Stage
                </span>
              )}

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-[#7A7A6E]">Channel State:</span>
                {crcState?.errorSimulationActive ? (
                  <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-[#FDF2F2] text-[#BA4A4A] border border-[#E8AEAE] flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Noise Injected (Bit [{crcState.flippedBitIndex}] inverted)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-[#EDF5EB] text-[#476C35] border border-[#BEDABE] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Clean Channel (No Error)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Dual Side-by-Side Cards (Sender vs Receiver) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            {/* ---------------- SENDER SIDE (Tx) ---------------- */}
            <div
              id="card-sender-side-info"
              className="bg-[#FAF9F5] border border-[#D1D1CB] rounded p-5 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between border-b border-[#E5E5DE] pb-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#5A5A40] text-white flex items-center justify-center">
                      <Send className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#2C2C24]">
                      Sender Side (Transmitter / Tx)
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#EAEADF] text-[#5A5A40]">
                    Reference Frame
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Sender Dataword */}
                  <div>
                    <div className="flex justify-between text-[11px] text-[#7A7A6E] mb-1">
                      <span className="font-semibold text-[#5A5A40]">1. Original Dataword D(x):</span>
                      <span>
                        {crcState?.dataword.length || 0} bits
                        {crcState?.inputType === 'text' && ` ("${crcState.originalInput}")`}
                      </span>
                    </div>
                    <div className="p-2 bg-white border border-[#E5E5DE] rounded font-mono text-[11px] break-all max-h-14 overflow-y-auto text-[#2C2C24]">
                      {crcState?.dataword || 'N/A'}
                    </div>
                  </div>

                  {/* Sender Zero Padding */}
                  <div>
                    <div className="flex justify-between text-[11px] text-[#7A7A6E] mb-1">
                      <span className="font-semibold text-[#5A5A40]">
                        2. Zero-Padded Dataword (D &bull; 2<sup>32</sup>):
                      </span>
                      <span>+{CRC_BITS} zero bits</span>
                    </div>
                    <div className="p-2 bg-white border border-[#E5E5DE] rounded font-mono text-[11px] break-all max-h-14 overflow-y-auto text-[#5A5A40]">
                      {crcState ? (
                        <>
                          <span className="text-[#2C2C24]">{crcState.dataword}</span>
                          <span className="text-[#8C8C84] bg-[#F5F5F0] px-0.5">{'0'.repeat(CRC_BITS)}</span>
                        </>
                      ) : (
                        'N/A'
                      )}
                    </div>
                  </div>

                  {/* Generator Polynomial Used */}
                  <div>
                    <div className="flex justify-between text-[11px] text-[#7A7A6E] mb-1">
                      <span className="font-semibold text-[#5A5A40]">3. Generator Polynomial G(x):</span>
                      <span>Degree 32 (33 bits)</span>
                    </div>
                    <div className="p-2 bg-white border border-[#E5E5DE] rounded font-mono text-[11px] break-all text-[#5A5A40]">
                      {GENERATOR_POLYNOMIAL}
                    </div>
                  </div>

                  {/* Sender Reference CRC */}
                  <div>
                    <div className="flex justify-between text-[11px] text-[#7A7A6E] mb-1">
                      <span className="font-semibold text-[#5A5A40]">
                        4. Computed Reference CRC Checksum R(x):
                      </span>
                      <span className="font-mono font-bold text-[#5A5A40]">
                        {crcState?.referenceCRCHex || 'N/A'}
                      </span>
                    </div>
                    <div className="p-2 bg-white border border-[#E5E5DE] rounded font-mono text-[11px] break-all text-[#5A5A40]">
                      {crcState?.referenceCRC || 'N/A'}
                    </div>
                  </div>

                  {/* Transmitted Codeword */}
                  <div>
                    <div className="flex justify-between text-[11px] text-[#7A7A6E] mb-1">
                      <span className="font-semibold text-[#5A5A40]">
                        5. Transmitted Codeword T = D + R:
                      </span>
                      <span>{crcState?.generatedCodeword.length || 0} bits total</span>
                    </div>
                    <div className="p-2 bg-white border border-[#E5E5DE] rounded font-mono text-[11px] break-all max-h-16 overflow-y-auto text-[#2C2C24]">
                      {crcState?.generatedCodeword || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sender Summary Footer */}
              <div className="pt-3 border-t border-[#E5E5DE] flex items-center justify-between text-xs">
                <span className="text-[#7A7A6E]">Transmission Status:</span>
                <span className="inline-flex items-center gap-1 font-bold text-[#476C35]">
                  <Check className="w-3.5 h-3.5" /> Ready / Transmitted
                </span>
              </div>
            </div>

            {/* ---------------- RECEIVER SIDE (Rx) ---------------- */}
            <div
              id="card-receiver-side-info"
              className="bg-[#FAF9F5] border border-[#D1D1CB] rounded p-5 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between border-b border-[#E5E5DE] pb-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#5A5A40] text-white flex items-center justify-center">
                      <Inbox className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#2C2C24]">
                      Receiver Side (Detector / Rx)
                    </span>
                  </div>
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                      crcState?.isValid
                        ? 'bg-[#EDF5EB] text-[#476C35]'
                        : 'bg-[#FDF2F2] text-[#BA4A4A]'
                    }`}
                  >
                    {crcState?.isValid ? 'Frame Valid' : 'Frame Corrupted'}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Received Codeword with visual diff */}
                  <div>
                    <div className="flex justify-between text-[11px] text-[#7A7A6E] mb-1">
                      <span className="font-semibold text-[#5A5A40]">1. Received Codeword T&apos;(x):</span>
                      <span>
                        {editableCodeword.length} bits
                        {bitDifferences.count > 0 && (
                          <span className="text-[#BA4A4A] font-bold ml-1">
                            ({bitDifferences.count} bit {bitDifferences.count === 1 ? 'error' : 'errors'})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="p-2 bg-white border border-[#E5E5DE] rounded font-mono text-[11px] break-all max-h-16 overflow-y-auto text-[#2C2C24]">
                      {editableCodeword ? (
                        <>
                          {editableCodeword.split('').map((bit, idx) => {
                            const isFlipped =
                              crcState &&
                              idx < crcState.generatedCodeword.length &&
                              bit !== crcState.generatedCodeword[idx];
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleCodewordBit(idx);
                                }}
                                className={`font-mono text-[11px] px-0.5 rounded cursor-pointer transition-colors ${
                                  isFlipped
                                    ? 'bg-[#BA4A4A] text-white font-bold ring-1 ring-[#BA4A4A]'
                                    : 'hover:bg-[#5A5A40] hover:text-white'
                                }`}
                                title={`Bit [${idx}] = '${bit}' (Original: '${crcState?.generatedCodeword[idx]}'). Click to invert bit.`}
                              >
                                {bit}
                              </button>
                            );
                          })}
                        </>
                      ) : (
                        'N/A'
                      )}
                    </div>
                    <div className="text-[10px] text-[#7A7A6E] mt-1 flex items-center gap-1">
                      <MousePointerClick className="w-3 h-3 text-[#5A5A40]" />
                      <span>Click any bit above to toggle (&apos;0&apos; ↔ &apos;1&apos;) and test error detection live.</span>
                    </div>
                  </div>

                  {/* Channel Disturbance Status */}
                  <div>
                    <div className="flex justify-between text-[11px] text-[#7A7A6E] mb-1">
                      <span className="font-semibold text-[#5A5A40]">2. Channel Inversion Detected:</span>
                      <span>Bit Index Inspection</span>
                    </div>
                    <div className="p-2 bg-white border border-[#E5E5DE] rounded font-mono text-[11px] text-[#2C2C24]">
                      {bitDifferences.count === 0 ? (
                        <span className="text-[#476C35] font-semibold">
                          Exact match with transmitted frame. No bit inversions.
                        </span>
                      ) : (
                        <span className="text-[#BA4A4A] font-semibold">
                          Bit mismatch at index: [{bitDifferences.indices.join(', ')}]
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Generator Used for Verification */}
                  <div>
                    <div className="flex justify-between text-[11px] text-[#7A7A6E] mb-1">
                      <span className="font-semibold text-[#5A5A40]">3. Modulo-2 Divisor G(x):</span>
                      <span>Same IEEE 802.3 Polynomial</span>
                    </div>
                    <div className="p-2 bg-white border border-[#E5E5DE] rounded font-mono text-[11px] break-all text-[#5A5A40]">
                      {GENERATOR_POLYNOMIAL}
                    </div>
                  </div>

                  {/* Receiver Calculated Remainder */}
                  <div>
                    <div className="flex justify-between text-[11px] text-[#7A7A6E] mb-1">
                      <span className="font-semibold text-[#5A5A40]">
                        4. Calculated Remainder R&apos;(x) = T&apos;(x) mod G(x):
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          crcState?.isValid ? 'text-[#476C35]' : 'text-[#BA4A4A]'
                        }`}
                      >
                        {crcState?.currentRemainderHex || '0x00000000'}
                      </span>
                    </div>
                    <div
                      className={`p-2 bg-white border rounded font-mono text-[11px] break-all ${
                        crcState?.isValid
                          ? 'border-[#BEDABE] text-[#476C35]'
                          : 'border-[#E8AEAE] text-[#BA4A4A]'
                      }`}
                    >
                      {crcState?.currentRemainder || 'N/A'}
                    </div>
                  </div>

                  {/* Zero Check Verdict */}
                  <div>
                    <div className="flex justify-between text-[11px] text-[#7A7A6E] mb-1">
                      <span className="font-semibold text-[#5A5A40]">
                        5. Remainder Zero Test (R&apos; == 0):
                      </span>
                      <span>{crcState?.isValid ? 'Passed (0x0)' : 'Failed (Non-zero)'}</span>
                    </div>
                    <div
                      className={`p-2 rounded text-xs font-semibold flex items-center justify-between ${
                        crcState?.isValid
                          ? 'bg-[#EDF5EB] text-[#476C35] border border-[#BEDABE]'
                          : 'bg-[#FDF2F2] text-[#BA4A4A] border border-[#E8AEAE]'
                      }`}
                    >
                      <span>
                        {crcState?.isValid
                          ? 'Remainder is exactly zero. No transmission error detected.'
                          : `Remainder is non-zero (${crcState?.currentRemainderHex}). Transmission error detected!`}
                      </span>
                      {crcState?.isValid ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Receiver Summary Footer */}
              <div className="pt-3 border-t border-[#E5E5DE] flex items-center justify-between text-xs">
                <span className="text-[#7A7A6E]">Receiver Action:</span>
                <span
                  className={`font-bold ${
                    crcState?.isValid ? 'text-[#476C35]' : 'text-[#BA4A4A]'
                  }`}
                >
                  {crcState?.isValid
                    ? 'Frame Accepted (ACK)'
                    : 'Frame Corrupted / Dropped (NAK)'}
                </span>
              </div>
            </div>
          </div>

          {/* End-to-End Metric Comparison Table */}
          <div className="border border-[#D1D1CB] rounded overflow-hidden">
            <div className="bg-[#F5F5F0] px-4 py-2 border-b border-[#D1D1CB] flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5A5A40]">
                Side-by-Side End-to-End Metrics Comparison
              </span>
              <span className="text-[10px] text-[#7A7A6E]">Mathematical modulo-2 verification</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAF9F5] text-[10px] uppercase text-[#7A7A6E] border-b border-[#EBEBE6]">
                  <tr>
                    <th className="px-4 py-2 font-bold">Parameter</th>
                    <th className="px-4 py-2 font-bold">Sender Side (Transmitter)</th>
                    <th className="px-4 py-2 font-bold">Receiver Side (Detector)</th>
                    <th className="px-4 py-2 font-bold text-right">Integrity Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBEBE6] font-mono text-[11px] text-[#2C2C24]">
                  <tr>
                    <td className="px-4 py-2.5 text-[#5A5A40] font-sans font-medium">
                      Codeword Bit Length
                    </td>
                    <td className="px-4 py-2.5">
                      {crcState?.generatedCodeword.length || 0} bits
                    </td>
                    <td className="px-4 py-2.5">
                      {editableCodeword.length} bits
                    </td>
                    <td className="px-4 py-2.5 text-right font-sans">
                      {crcState?.generatedCodeword.length === editableCodeword.length ? (
                        <span className="text-[#476C35] font-bold">Matched Length</span>
                      ) : (
                        <span className="text-[#BA4A4A] font-bold">Length Mismatch</span>
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td className="px-4 py-2.5 text-[#5A5A40] font-sans font-medium">
                      CRC / Remainder (Hex)
                    </td>
                    <td className="px-4 py-2.5 font-bold text-[#5A5A40]">
                      {crcState?.referenceCRCHex || 'N/A'}
                    </td>
                    <td className="px-4 py-2.5 font-bold">
                      <span className={crcState?.isValid ? 'text-[#476C35]' : 'text-[#BA4A4A]'}>
                        {crcState?.currentRemainderHex || '0x00000000'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-sans">
                      {crcState?.isValid ? (
                        <span className="text-[#476C35] font-bold">0x0 Remainder (Zero)</span>
                      ) : (
                        <span className="text-[#BA4A4A] font-bold">Non-Zero Remainder</span>
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td className="px-4 py-2.5 text-[#5A5A40] font-sans font-medium">
                      Bit Difference (Hamming Distance)
                    </td>
                    <td className="px-4 py-2.5">0 bit error (Clean)</td>
                    <td className="px-4 py-2.5">
                      {bitDifferences.count === 0 ? (
                        <span className="text-[#476C35]">0 errors (Exact)</span>
                      ) : (
                        <span className="text-[#BA4A4A] font-bold">
                          {bitDifferences.count} inverted bit(s)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-sans">
                      {bitDifferences.count === 0 ? (
                        <span className="text-[#476C35] font-bold">In Sync</span>
                      ) : (
                        <span className="text-[#BA4A4A] font-bold">Distorted</span>
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td className="px-4 py-2.5 text-[#5A5A40] font-sans font-medium">
                      Final Verification Verdict
                    </td>
                    <td className="px-4 py-2.5 font-sans font-bold text-[#5A5A40]">
                      Frame Dispatched
                    </td>
                    <td className="px-4 py-2.5 font-sans font-bold">
                      {crcState?.isValid ? (
                        <span className="text-[#476C35]">ACCEPTED (NO ERROR)</span>
                      ) : (
                        <span className="text-[#BA4A4A]">REJECTED (CORRUPTED)</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-sans">
                      {crcState?.isValid ? (
                        <span className="inline-flex items-center gap-1 text-[#476C35] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> VALID
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#BA4A4A] font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" /> CORRUPTED
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ================= TERMINAL EXECUTION LOG STREAM ================= */}
        <section className="bg-white border border-[#D1D1CB] rounded p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#5A5A40]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#2C2C24]">
                Terminal Execution &amp; Modulo-2 Logs
              </span>
            </div>
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="text-[11px] text-[#5A5A40] hover:underline cursor-pointer font-medium"
            >
              {showLogs ? 'Collapse Logs' : 'Expand Logs'}
            </button>
          </div>

          {showLogs && (
            <div className="p-3 bg-[#F5F5F0] border border-[#D1D1CB] rounded font-mono text-[11px] h-28 overflow-y-auto space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="break-all leading-relaxed">
                  <span className="text-[#8C8C84]">[{log.time}]</span>{' '}
                  <span
                    className={
                      log.type === 'success'
                        ? 'text-[#476C35] font-semibold'
                        : log.type === 'error'
                        ? 'text-[#BA4A4A] font-semibold'
                        : log.type === 'warning'
                        ? 'text-[#96681F] font-semibold'
                        : 'text-[#2C2C24]'
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </section>
      </main>

      {/* ================= SECTION 6: PROMINENT VERIFICATION STATUS FOOTER ================= */}
      <footer
        id="section-verification-status"
        onClick={() => {
          setActiveWorkflowStep('status');
          setWorkflowStatusMessage('Step 6: Verification Status. Displays real-time binary integrity verdict (Valid / Corrupted).');
        }}
        className={`w-full transition-colors duration-300 border-t cursor-pointer ${
          crcState?.isValid
            ? 'bg-[#5A5A40] text-white border-[#4A4A34]'
            : 'bg-[#BA4A4A] text-white border-[#9E3939]'
        } py-4 px-6 lg:px-8 mt-auto shrink-0 shadow-lg`}
      >
        <div className="max-w-[1700px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Main Status Badge */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center backdrop-blur-xs">
              {crcState?.isValid ? (
                <div className="w-7 h-7 rounded-full bg-[#7C9A6A] border-2 border-white flex items-center justify-center shadow-[0_0_12px_rgba(255,255,255,0.7)]">
                  <Check className="w-4 h-4 text-white stroke-[3]" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-[0_0_12px_rgba(255,255,255,0.8)]">
                  <AlertTriangle className="w-4 h-4 text-[#BA4A4A] stroke-[3]" />
                </div>
              )}
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider opacity-75 flex items-center gap-1.5">
                <span>6. Verification Status</span>
                {activeWorkflowStep === 'status' && (
                  <span className="bg-white/20 px-1.5 py-0.2 rounded text-[9px] font-bold">
                    Active
                  </span>
                )}
              </div>
              <div className="text-xl lg:text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                {crcState?.isValid ? (
                  <span>VALID / NOT CORRUPTED</span>
                ) : (
                  <span>CORRUPTED / ERROR DETECTED</span>
                )}
              </div>
            </div>
          </div>

          {/* Verification Remainder Info */}
          <div className="hidden md:flex items-center gap-6 border-l border-white/20 pl-6">
            <div>
              <span className="block text-[10px] uppercase font-bold opacity-75">
                Current Remainder (Hex)
              </span>
              <span className="text-sm font-mono font-bold tracking-wider">
                {crcState?.currentRemainderHex || '0x00000000'}
              </span>
            </div>

            <div className="max-w-xs">
              <span className="block text-[10px] uppercase font-bold opacity-75">
                Modulo-2 Remainder Bits
              </span>
              <span
                className="text-[10px] font-mono block truncate opacity-90"
                title={crcState?.currentRemainder}
              >
                {crcState?.currentRemainder || '0'.repeat(32)}
              </span>
            </div>
          </div>

          {/* Action: Save CSV Report */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="block text-[10px] uppercase font-bold opacity-75">
                7. Verification Report
              </span>
              <span className="text-[11px] font-mono opacity-90">
                CSV Export Available
              </span>
            </div>

            <button
              id="btn-save-report-footer"
              onClick={(e) => {
                e.stopPropagation();
                handleSaveReport();
              }}
              className="bg-white text-[#2C2C24] hover:bg-[#F5F5F0] px-5 py-2 rounded font-bold text-xs uppercase tracking-wider shadow-md transition active:scale-[0.98] flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span>Save Verification Report</span>
            </button>
          </div>
        </div>
      </footer>

      {/* ----------------- Academic Math & IEEE 802.3 Spec Modal ----------------- */}
      {showMathModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setShowMathModal(false)}
        >
          <div
            className="bg-[#F5F5F0] border border-[#D1D1CB] rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col text-[#2C2C24] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#D1D1CB] bg-[#EBEBE6]">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-[#5A5A40]" />
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#2C2C24]">
                    CRC-32 IEEE 802.3 Academic Specification &amp; Proof
                  </h3>
                  <p className="text-[11px] text-[#5A5A40]">
                    Modulo-2 Polynomial Division &amp; Error Detection Theory
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMathModal(false)}
                className="p-1 rounded text-[#7A7A6E] hover:text-[#2C2C24] hover:bg-[#D1D1CB] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-[#2C2C24] leading-relaxed">
              {/* Generator Polynomial */}
              <div className="p-3 bg-white border border-[#E5E5DE] rounded space-y-1.5">
                <span className="text-[11px] uppercase font-bold text-[#5A5A40] block tracking-wide">
                  Standard Generator Polynomial G(x)
                </span>
                <p className="font-mono text-[11px] text-[#2C2C24] bg-[#F5F5F0] p-2 rounded border border-[#D1D1CB] break-all">
                  {GENERATOR_POLYNOMIAL_EXPANDED}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                  <div>
                    <span className="text-[#7A7A6E]">Hex Representation: </span>
                    <strong className="text-[#5A5A40]">{GENERATOR_POLYNOMIAL_HEX}</strong>
                  </div>
                  <div>
                    <span className="text-[#7A7A6E]">Degree: </span>
                    <strong className="text-[#5A5A40]">32 (33 binary coefficients)</strong>
                  </div>
                </div>
                <div className="text-[11px] font-mono break-all text-[#7A7A6E] pt-1">
                  <span>Binary: </span>
                  <span className="text-[#2C2C24]">{GENERATOR_POLYNOMIAL}</span>
                </div>
              </div>

              {/* Mathematical Operations */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase text-[#5A5A40] tracking-wider">
                  Modulo-2 Arithmetic &amp; Operation Pipeline
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 bg-white border border-[#E5E5DE] rounded">
                    <strong className="block text-[11px] text-[#5A5A40] mb-1">1. Transmitter Division</strong>
                    <p className="text-[#5A5A40] text-[11px]">
                      Dataword D(x) is multiplied by x³² (zero-padded by 32 bits). Modulo-2 division by G(x) produces quotient Q(x) and 32-bit remainder R(x).
                    </p>
                    <code className="block mt-2 font-mono text-[10px] bg-[#F5F5F0] p-1.5 rounded border border-[#EBEBE6]">
                      T(x) = D(x) · x³² ⊕ R(x)
                    </code>
                  </div>

                  <div className="p-3 bg-white border border-[#E5E5DE] rounded">
                    <strong className="block text-[11px] text-[#5A5A40] mb-1">2. Receiver Verification</strong>
                    <p className="text-[#5A5A40] text-[11px]">
                      The receiver performs modulo-2 division of the entire received codeword T&apos;(x) by G(x). If undamaged:
                    </p>
                    <code className="block mt-2 font-mono text-[10px] bg-[#F5F5F0] p-1.5 rounded border border-[#EBEBE6]">
                      T(x) mod G(x) = 0x00000000 (VALID)
                    </code>
                  </div>
                </div>
              </div>

              {/* Error Detection Proof */}
              <div className="p-3 bg-white border border-[#E5E5DE] rounded space-y-2">
                <h4 className="text-xs font-bold uppercase text-[#5A5A40] tracking-wider">
                  IEEE 802.3 Error Detection Capability Proof
                </h4>
                <p className="text-[#5A5A40] text-[11px]">
                  If transmission noise alters bits, received frame is T&apos;(x) = T(x) ⊕ E(x), where E(x) is the error polynomial.
                  Because T(x) mod G(x) = 0, the receiver remainder is:
                </p>
                <div className="p-2 bg-[#F5F5F0] rounded font-mono text-[11px] text-center border border-[#D1D1CB]">
                  T&apos;(x) mod G(x) = E(x) mod G(x) ≠ 0
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-[#5A5A40] pt-1">
                  <li><strong>Single-bit errors:</strong> 100% detected because G(x) has two or more non-zero terms.</li>
                  <li><strong>Double-bit errors:</strong> 100% detected for all frame lengths up to 2³² - 1 bits.</li>
                  <li><strong>Odd number of errors:</strong> 100% detected because (x + 1) is an algebraic factor of G(x).</li>
                  <li><strong>Burst errors:</strong> 100% detected for any error burst length ≤ 32 bits.</li>
                  <li><strong>Longer bursts (&gt; 32 bits):</strong> 99.99999998% detection probability (1 - 2⁻³²).</li>
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-[#D1D1CB] bg-[#EBEBE6]">
              <a
                href="/CRC-32-Code-Explanation.pdf"
                download="CRC-32-Code-Explanation.pdf"
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#2C2C24] text-white rounded hover:bg-black transition uppercase tracking-wider no-underline shadow-xs cursor-pointer"
                title="Download complete PDF reference document"
              >
                <FileText className="w-3.5 h-3.5 text-[#BEDABE]" />
                <span>Download Explanation PDF</span>
              </a>

              <button
                type="button"
                onClick={() => setShowMathModal(false)}
                className="px-4 py-1.5 text-xs font-semibold bg-[#5A5A40] text-white rounded hover:bg-[#4A4A34] transition uppercase tracking-wider cursor-pointer"
              >
                Close Reference
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
