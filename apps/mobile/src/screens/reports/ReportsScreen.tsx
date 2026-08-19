import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, RefreshControl, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listStudentReports, submitStudentReport } from '../../services/reports';
import type { DbReport } from '@ojt/shared';

const REPORT_TYPES = [
  'Weekly Progress Report',
  'Monthly Narrative Report',
  'Daily Time Record (DTR)',
  'Final OJT Portfolio',
  'Certificate of Completion',
  'Incident Report',
];

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<DbReport[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState(REPORT_TYPES[0]);
  const [filePath, setFilePath] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const res = await listStudentReports(1, 50);
    if (res.error) {
      setError(res.error.message);
    } else {
      setReports(res.data?.reports || []);
      setTotal(res.data?.total || 0);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  async function handleOpenSubmit() {
    setModalError('');
    setFilePath('');
    setRemarks('');
    setSelectedType(REPORT_TYPES[0]);
    setModalVisible(true);
  }

  async function handleSubmit() {
    if (!filePath.trim()) {
      setModalError('Please provide a document link or cloud file path.');
      return;
    }

    setSubmitting(true);
    setModalError('');

    const res = await submitStudentReport({
      report_type: selectedType,
      file_path: filePath.trim(),
      remarks: remarks.trim(),
    });

    setSubmitting(false);

    if (res.error) {
      setModalError(res.error.message);
      return;
    }

    setModalVisible(false);
    load();
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#0A3D24" />
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerKicker}>Colegio de Montalban OJT</Text>
          <Text style={s.title}>Digital Reports</Text>
          <Text style={s.subtitle}>{total} document{total !== 1 ? 's' : ''} submitted</Text>
        </View>
        <TouchableOpacity
          onPress={handleOpenSubmit}
          style={s.btnSubmitHeader}
          activeOpacity={0.85}
        >
          <Text style={s.btnSubmitHeaderText}>+ SUBMIT</Text>
        </TouchableOpacity>
      </View>

      {!!error && (
        <View style={s.alertError}>
          <Text style={s.alertErrorText}>⚠ {error}</Text>
        </View>
      )}

      {/* Reports List */}
      <FlatList
        data={reports}
        keyExtractor={(item) => item.report_id}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0A3D24']} />}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>📁</Text>
            <Text style={s.emptyTitle}>No reports submitted yet</Text>
            <Text style={s.emptySub}>
              Submit your weekly logs, DTR copies, or required documentation here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.reportCard}>
            <View style={s.cardTopRow}>
              <Text style={s.reportType}>{item.report_type}</Text>
              <View style={[
                s.statusBadge,
                item.status === 'approved' ? s.badgeGreen :
                item.status === 'reviewed' ? s.badgeBlue :
                item.status === 'rejected' ? s.badgeRed : s.badgeAmber
              ]}>
                <Text style={[
                  s.statusBadgeText,
                  item.status === 'approved' ? s.textGreen :
                  item.status === 'reviewed' ? s.textBlue :
                  item.status === 'rejected' ? s.textRed : s.textAmber
                ]}>
                  {item.status}
                </Text>
              </View>
            </View>

            <Text style={s.dateText}>
              Submitted: {new Date(item.submission_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>

            <View style={s.fileBox}>
              <Text style={s.fileText} numberOfLines={1}>
                📄 {item.file_path}
              </Text>
            </View>

            {!!item.remarks && (
              <View style={s.remarksBox}>
                <Text style={s.remarksLabel}>Coordinator Remarks:</Text>
                <Text style={s.remarksText}>{item.remarks}</Text>
              </View>
            )}
          </View>
        )}
      />

      {/* Submit Report Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={s.modalBackdrop}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Submit OJT Document</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {!!modalError && (
              <View style={s.alertError}>
                <Text style={s.alertErrorText}>{modalError}</Text>
              </View>
            )}

            <Text style={s.fieldLabel}>Document Type</Text>
            <View style={s.typeWrap}>
              {REPORT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setSelectedType(type)}
                  style={[s.typePill, selectedType === type && s.typePillActive]}
                >
                  <Text style={[s.typePillText, selectedType === type && s.typePillTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fieldLabel}>File Link / Document URL / Reference</Text>
            <TextInput
              value={filePath}
              onChangeText={setFilePath}
              placeholder="e.g. drive.google.com/... or weekly_report_w1.pdf"
              style={s.input}
              autoCapitalize="none"
            />

            <Text style={s.fieldLabel}>Student Remarks (Optional)</Text>
            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Add any notes for your coordinator..."
              style={[s.input, { height: 72, textAlignVertical: 'top' }]}
              multiline
            />

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={s.btnSubmitModal}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFCC00" />
              ) : (
                <Text style={s.btnSubmitModalText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f6f9' },
  center: { flex: 1, backgroundColor: '#f4f6f9', alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerKicker: { fontSize: 11, fontWeight: '800', color: '#0A3D24', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 24, fontWeight: '900', color: '#062415' },
  subtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  btnSubmitHeader: {
    backgroundColor: '#0A3D24',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#0A3D24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,204,0,0.3)',
  },
  btnSubmitHeaderText: { color: '#FFCC00', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  alertError: { marginHorizontal: 20, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 12, marginBottom: 12 },
  alertErrorText: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
  listContent: { paddingHorizontal: 20, paddingBottom: 32, gap: 12 },
  reportCard: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  reportType: { fontSize: 15, fontWeight: '800', color: '#062415', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  badgeGreen: { backgroundColor: 'rgba(10,61,36,0.1)' },
  textGreen: { color: '#0A3D24', fontWeight: '800' },
  badgeBlue: { backgroundColor: '#dbeafe' },
  textBlue: { color: '#1d4ed8', fontWeight: '800' },
  badgeRed: { backgroundColor: '#fee2e2' },
  textRed: { color: '#dc2626', fontWeight: '800' },
  badgeAmber: { backgroundColor: '#fef3c7' },
  textAmber: { color: '#d97706', fontWeight: '800' },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  dateText: { fontSize: 12, color: '#94a3b8', marginBottom: 10 },
  fileBox: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  fileText: { fontSize: 12, color: '#334155', fontWeight: '600' },
  remarksBox: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8, marginTop: 4 },
  remarksLabel: { fontSize: 11, fontWeight: '700', color: '#475569' },
  remarksText: { fontSize: 12, color: '#64748b', marginTop: 2 },
  emptyBox: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155' },
  emptySub: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 4, paddingHorizontal: 20 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0A3D24' },
  modalClose: { fontSize: 18, fontWeight: '700', color: '#94a3b8' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 },
  typeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  typePill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  typePillActive: { backgroundColor: 'rgba(10,61,36,0.08)', borderColor: '#0A3D24' },
  typePillText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  typePillTextActive: { color: '#0A3D24', fontWeight: '800' },
  input: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: '#0f172a', backgroundColor: '#f8fafc', marginBottom: 16 },
  btnSubmitModal: {
    backgroundColor: '#0A3D24',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#0A3D24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,204,0,0.3)',
  },
  btnSubmitModalText: { color: '#FFCC00', fontSize: 14, fontWeight: '800' },
});
