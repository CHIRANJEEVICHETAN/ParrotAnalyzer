import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator, 
  StyleSheet,
  Modal,
  Pressable 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReportSection } from '../types';
import { PDFGenerator } from '../services/PDFGenerator';

interface ReportCardProps {
  section: ReportSection;
  isDark: boolean;
  children?: React.ReactNode;
}

export default function ReportCard({ section, isDark, children }: ReportCardProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);

  const handleExportAction = async (action: 'open' | 'share') => {
    try {
      setIsExporting(true);
      setShowActionMenu(false);
      await PDFGenerator.generateAndHandlePDF(section, action);
    } catch (error) {
      console.error('Error handling PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={[styles.card, {
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      borderRadius: 8,
      padding: 16,
      marginBottom: 16,
    }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ 
            fontSize: 18, 
            fontWeight: '600',
            color: isDark ? '#FFFFFF' : '#111827',
            marginBottom: 4
          }}>
            {section.title}
          </Text>
          <Text style={{ 
            fontSize: 14,
            color: isDark ? '#9CA3AF' : '#6B7280'
          }}>
            {section.description}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowActionMenu(true)}
          disabled={isExporting}
          style={[
            styles.exportButton,
            {
              backgroundColor: '#3B82F6',
              opacity: isExporting ? 0.5 : 1
            }
          ]}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons 
                name="document-text-outline" 
                size={18} 
                color="#FFFFFF" 
              />
              <Text style={{ 
                color: '#FFFFFF', 
                marginLeft: 6,
                fontSize: 14,
                fontWeight: '500'
              }}>
                Export PDF
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {children}

      {/* Updated Modal Design */}
      <Modal
        visible={showActionMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionMenu(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowActionMenu(false)}
        >
          <Pressable 
            style={[
              styles.actionMenu,
              {
                backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
              }
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: isDark ? '#FFFFFF' : '#111827',
              marginBottom: 16,
              textAlign: 'center'
            }}>
              Export Options
            </Text>
            
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: '#3B82F6',
                  marginBottom: 12,
                }
              ]}
              onPress={() => handleExportAction('open')}
            >
              <Ionicons 
                name="open-outline" 
                size={22} 
                color="#FFFFFF" 
              />
              <Text style={styles.actionButtonText}>
                Open PDF
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: '#3B82F6',
                }
              ]}
              onPress={() => handleExportAction('share')}
            >
              <Ionicons 
                name="share-outline" 
                size={22} 
                color="#FFFFFF" 
              />
              <Text style={styles.actionButtonText}>
                Share PDF
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionMenu: {
    width: '85%',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
  },
  actionButtonText: {
    color: '#FFFFFF',
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '500',
  },
}); 