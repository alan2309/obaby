import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, Card, HelperText } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { scaleSize, platformStyle, isTablet } from '../../utils/constants';

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // const [name, setName] = useState('');
  // const [phone, setPhone] = useState('');
  // const [city, setCity] = useState('');
  // const [salesmanId, setSalesmanId] = useState('');
  // const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');

  const { login /*, register*/ } = useAuth();

  const handleSubmit = async () => {
    setError('');
    setEmailError('');

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      // Registration disabled
      // if (isRegistering) { ... } 

      await login(email, password);
    } catch (err: any) {
      const errorMessage = err.message;
      setError(errorMessage);

      if (errorMessage.includes('already registered')) {
        setEmailError('Email already in use');
      }
    } finally {
      setLoading(false);
    }
  };

  // const resetForm = () => {
  //   setEmail('');
  //   setPassword('');
  //   setName('');
  //   setPhone('');
  //   setCity('');
  //   setSalesmanId('');
  //   setError('');
  //   setEmailError('');
  // };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (emailError) setEmailError('');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Card.Content>

            <Text variant="headlineMedium" style={styles.title}>
              Business Manager
            </Text>

            <Text variant="bodyMedium" style={styles.subtitle}>
              Sign in to your account
            </Text>

            {error && !emailError && (
              <View style={styles.errorContainer}>
                <Text style={styles.error}>{error}</Text>
              </View>
            )}

            {/* REGISTRATION FORM COMMENTED OUT */}

            <TextInput
              label="Email *"
              value={email}
              onChangeText={handleEmailChange}
              style={styles.input}
              mode="outlined"
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="Enter your email address"
              disabled={loading}
              error={!!emailError}
            />

            {emailError ? (
              <HelperText type="error" visible={true}>{emailError}</HelperText>
            ) : null}

            <TextInput
              label="Password *"
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              mode="outlined"
              secureTextEntry
              placeholder="Enter your password"
              disabled={loading}
            />

            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              Sign In
            </Button>

            {/* REGISTRATION SWITCH REMOVED */}

            <View style={styles.noteContainer}>
              <Text style={styles.noteText}>
                💡 Only administrators can create accounts.
              </Text>
            </View>

          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EDE0',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: platformStyle.padding,
  },
  card: {
    padding: scaleSize(16),
    maxWidth: 500,
    alignSelf: 'center',
    width: isTablet ? '70%' : '100%',
  },
  title: {
    textAlign: 'center',
    marginBottom: scaleSize(8),
    color: '#3B3B3B',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: scaleSize(24),
    color: '#666',
    fontSize: scaleSize(14),
  },
  input: {
    marginBottom: scaleSize(4),
  },
  button: {
    marginTop: scaleSize(8),
    backgroundColor: '#F7CAC9',
  },
  buttonContent: {
    paddingVertical: scaleSize(6),
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    padding: scaleSize(12),
    borderRadius: 8,
    marginBottom: scaleSize(16),
    borderLeftWidth: 4,
    borderLeftColor: '#FF5252',
  },
  error: {
    color: '#D32F2F',
    fontSize: scaleSize(14),
    textAlign: 'center',
  },
  noteContainer: {
    marginTop: scaleSize(16),
    padding: scaleSize(12),
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FFA000',
  },
  noteText: {
    color: '#666',
    fontSize: scaleSize(12),
    textAlign: 'center',
    lineHeight: scaleSize(16),
  },
});

export default LoginScreen;
