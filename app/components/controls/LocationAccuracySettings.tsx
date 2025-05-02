import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  getAccuracyFilterSettings, 
  saveAccuracyFilterSettings, 
  resetLocationFiltering,
  AccuracyFilterSettings
} from '../../utils/locationAccuracyFilter';

interface LocationAccuracySettingsProps {
  onClose?: () => void;
}

const LocationAccuracySettings: React.FC<LocationAccuracySettingsProps> = ({ onClose }) => {
  const [settings, setSettings] = useState<AccuracyFilterSettings>({
    enabled: true,
    maxAccuracyRadius: 100,
    goodAccuracyThreshold: 20,
    confidenceThreshold: 0.7,
    useSmoothing: true,
    rejectLowAccuracy: false
  });
  
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const loadedSettings = await getAccuracyFilterSettings();
    setSettings(loadedSettings);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await saveAccuracyFilterSettings(settings);
    setIsSaving(false);
    if (onClose) onClose();
  };

  const handleToggle = (field: keyof AccuracyFilterSettings) => {
    setSettings(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleSliderChange = (field: keyof AccuracyFilterSettings, value: number) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleReset = async () => {
    await resetLocationFiltering();
    await loadSettings();
  };

  // Render custom slider component since we don't have access to the imported one
  const CustomSlider = ({ 
    value, 
    onValueChange, 
    minimumValue, 
    maximumValue, 
    step, 
    disabled 
  }: { 
    value: number; 
    onValueChange: (value: number) => void; 
    minimumValue: number; 
    maximumValue: number; 
    step: number; 
    disabled?: boolean;
  }) => {
    return (
      <View style={{ height: 40, justifyContent: 'center' }}>
        <View style={{
          height: 4,
          backgroundColor: disabled ? '#e2e8f0' : '#cbd5e1',
          borderRadius: 2,
        }}>
          <View style={{
            position: 'absolute',
            left: 0,
            width: `${((value - minimumValue) / (maximumValue - minimumValue)) * 100}%`,
            height: 4,
            backgroundColor: disabled ? '#94a3b8' : '#3b82f6',
            borderRadius: 2,
          }} />
          <Pressable
            disabled={disabled}
            style={{
              position: 'absolute',
              top: -8,
              left: `${((value - minimumValue) / (maximumValue - minimumValue)) * 100}%`,
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: disabled ? '#94a3b8' : '#3b82f6',
              transform: [{ translateX: -10 }],
            }}
            onTouchMove={(e) => {
              if (disabled) return;
              const { locationX, pageX } = e.nativeEvent;
              const parentElement = e.currentTarget as any;
              const parentWidth = parentElement?.measure 
                ? parentElement.measure((x: number, y: number, width: number) => width) 
                : 300;
              
              // Calculate new value based on touch position
              let newX = pageX - locationX;
              let percentage = Math.max(0, Math.min(1, newX / parentWidth));
              let newValue = minimumValue + percentage * (maximumValue - minimumValue);
              
              // Apply step if provided
              if (step) {
                newValue = Math.round(newValue / step) * step;
              }
              
              onValueChange(newValue);
            }}
          />
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Location Accuracy Settings</Text>
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#64748b" />
          </Pressable>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Accuracy Filtering</Text>
        <Text style={styles.description}>
          Filters out low-quality location readings in challenging environments like urban canyons
          and indoor spaces.
        </Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Enable Accuracy Filtering</Text>
            <Text style={styles.settingDescription}>
              Filter out low-quality location readings
            </Text>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={() => handleToggle('enabled')}
            trackColor={{ false: '#cbd5e1', true: '#bfdbfe' }}
            thumbColor={settings.enabled ? '#3b82f6' : '#94a3b8'}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Reject Low Accuracy</Text>
            <Text style={styles.settingDescription}>
              Completely ignore readings with very low accuracy
            </Text>
          </View>
          <Switch
            value={settings.rejectLowAccuracy}
            onValueChange={() => handleToggle('rejectLowAccuracy')}
            trackColor={{ false: '#cbd5e1', true: '#bfdbfe' }}
            thumbColor={settings.rejectLowAccuracy ? '#3b82f6' : '#94a3b8'}
            disabled={!settings.enabled}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Enable Location Smoothing</Text>
            <Text style={styles.settingDescription}>
              Average recent locations for better stability
            </Text>
          </View>
          <Switch
            value={settings.useSmoothing}
            onValueChange={() => handleToggle('useSmoothing')}
            trackColor={{ false: '#cbd5e1', true: '#bfdbfe' }}
            thumbColor={settings.useSmoothing ? '#3b82f6' : '#94a3b8'}
            disabled={!settings.enabled}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Advanced Settings</Text>

        <View style={styles.sliderContainer}>
          <View style={styles.sliderLabelRow}>
            <Text style={styles.sliderLabel}>Maximum Accuracy Radius</Text>
            <Text style={styles.sliderValue}>{Math.round(settings.maxAccuracyRadius)}m</Text>
          </View>
          <CustomSlider
            minimumValue={50}
            maximumValue={200}
            step={5}
            value={settings.maxAccuracyRadius}
            onValueChange={(value: number) => handleSliderChange('maxAccuracyRadius', value)}
            disabled={!settings.enabled}
          />
          <View style={styles.sliderRangeLabels}>
            <Text style={styles.rangeLabel}>Strict (50m)</Text>
            <Text style={styles.rangeLabel}>Lenient (200m)</Text>
          </View>
        </View>

        <View style={styles.sliderContainer}>
          <View style={styles.sliderLabelRow}>
            <Text style={styles.sliderLabel}>Good Accuracy Threshold</Text>
            <Text style={styles.sliderValue}>{Math.round(settings.goodAccuracyThreshold)}m</Text>
          </View>
          <CustomSlider
            minimumValue={5}
            maximumValue={50}
            step={5}
            value={settings.goodAccuracyThreshold}
            onValueChange={(value: number) => handleSliderChange('goodAccuracyThreshold', value)}
            disabled={!settings.enabled}
          />
          <View style={styles.sliderRangeLabels}>
            <Text style={styles.rangeLabel}>Precise (5m)</Text>
            <Text style={styles.rangeLabel}>Relaxed (50m)</Text>
          </View>
        </View>

        <View style={styles.sliderContainer}>
          <View style={styles.sliderLabelRow}>
            <Text style={styles.sliderLabel}>Confidence Threshold</Text>
            <Text style={styles.sliderValue}>{(settings.confidenceThreshold).toFixed(1)}</Text>
          </View>
          <CustomSlider
            minimumValue={0.3}
            maximumValue={0.9}
            step={0.1}
            value={settings.confidenceThreshold}
            onValueChange={(value: number) => handleSliderChange('confidenceThreshold', value)}
            disabled={!settings.enabled}
          />
          <View style={styles.sliderRangeLabels}>
            <Text style={styles.rangeLabel}>More updates</Text>
            <Text style={styles.rangeLabel}>Higher quality</Text>
          </View>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <Pressable style={styles.resetButton} onPress={handleReset}>
          <Text style={styles.resetButtonText}>Reset History</Text>
        </Pressable>
        <Pressable 
          style={[styles.saveButton, isSaving && styles.savingButton]} 
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.helpSection}>
        <Text style={styles.helpTitle}>Understanding Accuracy Settings</Text>
        <Text style={styles.helpText}>
          <Text style={styles.bold}>• Maximum Accuracy Radius:</Text> The maximum uncertainty radius (in meters)
          for a location reading to be considered usable. Larger values accept more readings but may include less accurate positions.
        </Text>
        <Text style={styles.helpText}>
          <Text style={styles.bold}>• Good Accuracy Threshold:</Text> Readings with accuracy better than this value are
          considered high quality. Affects confidence scoring.
        </Text>
        <Text style={styles.helpText}>
          <Text style={styles.bold}>• Confidence Threshold:</Text> Minimum confidence score (0.0-1.0) required for a
          location reading to be accepted. Higher values mean stricter filtering.
        </Text>
        <Text style={styles.helpText}>
          <Text style={styles.bold}>• Location Smoothing:</Text> Reduces jitter by averaging recent positions,
          improving visual stability of your location on the map.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#334155',
  },
  closeButton: {
    padding: 8,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 20,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#64748b',
  },
  sliderContainer: {
    marginVertical: 16,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  sliderRangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  rangeLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  resetButton: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 8,
  },
  resetButtonText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 2,
  },
  savingButton: {
    backgroundColor: '#93c5fd',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  helpSection: {
    marginBottom: 30,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 10,
  },
  helpText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
    lineHeight: 18,
  },
  bold: {
    fontWeight: '600',
    color: '#475569',
  },
});

export default LocationAccuracySettings; 