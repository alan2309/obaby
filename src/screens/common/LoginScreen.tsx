import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, Card, SegmentedButtons } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES, scaleSize, platformStyle, isTablet } from '../../utils/constants';

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'customer' | 'salesman'>('customer');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, register } = useAuth();

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (isRegistering && (!name || !phone)) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isRegistering) {
        await register(email, password, {
          name,
          email,
          phone,
          role,
          approved: role === USER_ROLES.CUSTOMER ? false : true,
        });
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="headlineMedium" style={styles.title}>
              {isRegistering ? 'Create Account' : 'Business Manager'}
            </Text>
            
            {error ? (
              <Text style={styles.error}>{error}</Text>
            ) : null}

            {isRegistering && (
              <>
                <TextInput
                  label="Full Name"
                  value={name}
                  onChangeText={setName}
                  style={styles.input}
                  mode="outlined"
                />
                <TextInput
                  label="Phone Number"
                  value={phone}
                  onChangeText={setPhone}
                  style={styles.input}
                  mode="outlined"
                  keyboardType="phone-pad"
                />
                <SegmentedButtons
                  value={role}
                  onValueChange={(value) => setRole(value as 'customer' | 'salesman')}
                  buttons={[
                    { value: 'customer', label: 'Customer' },
                    { value: 'salesman', label: 'Salesman' },
                  ]}
                  style={styles.segment}
                />
              </>
            )}

            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              mode="outlined"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              mode="outlined"
              secureTextEntry
            />

            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              {isRegistering ? 'Create Account' : 'Sign In'}
            </Button>

            <View style={styles.switchContainer}>
              <Text variant="bodyMedium">
                {isRegistering ? 'Already have an account?' : "Don't have an account?"}
              </Text>
              <Button
                mode="text"
                onPress={() => setIsRegistering(!isRegistering)}
                compact
              >
                {isRegistering ? 'Sign In' : 'Create Account'}
              </Button>
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
    marginBottom: scaleSize(24),
    color: '#3B3B3B',
  },
  input: {
    marginBottom: scaleSize(16),
  },
  segment: {
    marginBottom: scaleSize(16),
  },
  button: {
    marginTop: scaleSize(8),
    backgroundColor: '#F7CAC9',
  },
  buttonContent: {
    paddingVertical: scaleSize(6),
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scaleSize(16),
    flexWrap: 'wrap',
  },
  error: {
    color: 'red',
    textAlign: 'center',
    marginBottom: scaleSize(16),
    fontSize: scaleSize(14),
  },
});

export default LoginScreen;