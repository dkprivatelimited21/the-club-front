import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, RefreshControl, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore, useClubStore } from '../src/store';
import { API_URL } from '../src/utils/config';
import { getSocket } from '../src/utils/socket';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { username } = useUserStore();
  const [publicClubs, setPublicClubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [joinError, setJoinError] = useState('');
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    fetchPublicClubs();
    // Init socket early
    getSocket();
  }, []);

  const fetchPublicClubs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/clubs/public`);
      const data = await res.json();
      setPublicClubs(data.clubs || []);
    } catch (e) {
      console.error('Failed to fetch clubs:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleJoinById = () => {
    const id = joinId.trim().toUpperCase();
    if (!id) { setJoinError('Enter a Club ID'); return; }
    if (!username) { router.push('/profile'); return; }
    setJoinError('');
    router.push(`/club/${id}`);
  };

  const handleQuickJoin = (clubId) => {
    if (!username) { router.push('/profile'); return; }
    router.push(`/club/${clubId}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050508' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPublicClubs(); }} tintColor="#7C3AED" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={{ opacity: fadeAnim, paddingHorizontal: 20, paddingTop: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <View>
              <Text style={{ fontSize: 28, fontWeight: '800', color: '#E8E8F0', letterSpacing: -0.5 }}>
                The Club 🎭
              </Text>
              <Text style={{ color: '#6B6B85', fontSize: 13, marginTop: 2 }}>
                {username ? `Hey, ${username} 👋` : 'Ephemeral. Private. Real-time.'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/profile')}
              style={{
                width: 42, height: 42, borderRadius: 21,
                backgroundColor: '#13131C', borderWidth: 1, borderColor: '#1E1E2E',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="person" size={18} color="#7C3AED" />
            </TouchableOpacity>
          </View>

          {/* Privacy banner */}
          <View style={{
            backgroundColor: '#0D0D14', borderRadius: 14, padding: 14, marginBottom: 24,
            borderWidth: 1, borderColor: '#1E1E2E', flexDirection: 'row', alignItems: 'center', gap: 10,
          }}>
            <View style={{ backgroundColor: '#4C1D95', borderRadius: 8, padding: 8 }}>
              <Ionicons name="shield-checkmark" size={16} color="#9F67FF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#E8E8F0', fontSize: 13, fontWeight: '600' }}>Zero persistence guaranteed</Text>
              <Text style={{ color: '#6B6B85', fontSize: 11, marginTop: 1 }}>Messages auto-delete in 10 min. No data stored.</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 28 }}>
            <TouchableOpacity
              onPress={() => { if (!username) { router.push('/profile'); return; } router.push('/create-club'); }}
              style={{
                flex: 1, backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 16,
                alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
              }}
            >
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Create Club</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { if (!username) { router.push('/profile'); return; } router.push('/join-club'); }}
              style={{
                flex: 1, backgroundColor: '#13131C', borderRadius: 14, paddingVertical: 16,
                alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                borderWidth: 1, borderColor: '#1E1E2E',
              }}
            >
              <Ionicons name="enter" size={20} color="#7C3AED" />
              <Text style={{ color: '#E8E8F0', fontWeight: '700', fontSize: 15 }}>Join Club</Text>
            </TouchableOpacity>
          </View>

          {/* Quick join by ID */}
          <View style={{ marginBottom: 28 }}>
            <Text style={{ color: '#6B6B85', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              Quick Join by ID
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                value={joinId}
                onChangeText={(t) => { setJoinId(t.toUpperCase()); setJoinError(''); }}
                placeholder="e.g. A1B2C3D4"
                placeholderTextColor="#6B6B85"
                autoCapitalize="characters"
                style={{
                  flex: 1, backgroundColor: '#13131C', borderRadius: 12, paddingHorizontal: 14,
                  paddingVertical: 12, color: '#E8E8F0', fontSize: 15, fontWeight: '600',
                  borderWidth: 1, borderColor: joinError ? '#EF4444' : '#1E1E2E',
                  letterSpacing: 2,
                }}
              />
              <TouchableOpacity
                onPress={handleJoinById}
                style={{ backgroundColor: '#13131C', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', borderWidth: 1, borderColor: '#1E1E2E' }}
              >
                <Ionicons name="arrow-forward" size={20} color="#7C3AED" />
              </TouchableOpacity>
            </View>
            {joinError ? <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 6 }}>{joinError}</Text> : null}
          </View>

          {/* Public clubs */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ color: '#6B6B85', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
              Live Clubs
            </Text>
            <TouchableOpacity onPress={fetchPublicClubs}>
              <Ionicons name="refresh" size={16} color="#6B6B85" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {loading && !refreshing ? (
          <ActivityIndicator color="#7C3AED" style={{ marginTop: 20 }} />
        ) : publicClubs.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 40, paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 40 }}>🎭</Text>
            <Text style={{ color: '#6B6B85', marginTop: 12, textAlign: 'center', fontSize: 15 }}>
              No clubs live right now.{'\n'}Be the first to start one!
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20, gap: 10 }}>
            {publicClubs.map((club) => (
              <ClubCard key={club.id} club={club} onJoin={handleQuickJoin} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ClubCard({ club, onJoin }) {
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <TouchableOpacity
      onPress={() => onJoin(club.id)}
      style={{
        backgroundColor: '#13131C', borderRadius: 14, padding: 16,
        borderWidth: 1, borderColor: '#1E1E2E',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}
      activeOpacity={0.7}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#E8E8F0', fontSize: 16, fontWeight: '700' }}>{club.name}</Text>
        <Text style={{ color: '#6B6B85', fontSize: 12, marginTop: 3 }}>
          Hosted by {club.host}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Animated.View style={{
            width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E',
            transform: [{ scale: pulseAnim }],
          }} />
          <Text style={{ color: '#22C55E', fontSize: 13, fontWeight: '600' }}>
            {club.userCount}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#6B6B85" />
      </View>
    </TouchableOpacity>
  );
}
