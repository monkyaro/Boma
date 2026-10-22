import React, { useEffect, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Notifications from 'expo-notifications';
import * as Crypto from 'expo-crypto';

WebBrowser.maybeCompleteAuthSession();
const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8100';
const ISSUER = process.env.EXPO_PUBLIC_OIDC_ISSUER || 'http://localhost:8180/realms/boma';
const CLIENT = process.env.EXPO_PUBLIC_OIDC_CLIENT_ID || 'boma-mobile';
const SESSION_KEY = 'boma-session';
type Session = { accessToken: string; refreshToken?: string; issuedAt: number; expiresIn?: number };
type Property = { listing_id: string; title: string; region: string; district?: string; listing_type: string; price: string; verification_status: string; status: string; version: number };
type Notice = { notification_id: string; body: string; read_at: string | null };
type Inquiry = { inquiry_id: string; listing_id: string; kind: string; status: string; scheduled_at?: string; officer_id?: string };
type Message = { message_id: string; body: string; from_me: boolean };
type Stay = { booking_id: string; check_in: string; check_out: string; guests: number; status: string };
type Identity = { case_id: string; status: string; user_id: string };

export default function App() {
  const discovery = AuthSession.useAutoDiscovery(ISSUER);
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'boma', path: 'auth' });
  const [request, response, promptAsync] = AuthSession.useAuthRequest({ clientId: CLIENT, redirectUri, scopes: ['openid', 'profile', 'email'], responseType: AuthSession.ResponseType.Code, usePKCE: true }, discovery);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ user_id: string; roles: string[] } | null>(null);
  const [tab, setTab] = useState('Explore');
  const [query, setQuery] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [selected, setSelected] = useState<Property | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [cases, setCases] = useState<Identity[]>([]);
  const [stays, setStays] = useState<Stay[]>([]);
  const [officerProperties, setOfficerProperties] = useState<Property[]>([]);
  const [conversation, setConversation] = useState<Inquiry | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [reference, setReference] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('1');
  const [bookingKey, setBookingKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function saveSession(next: Session) {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  }
  async function api<T>(path: string, method = 'GET', data?: unknown, supplied?: Session): Promise<T> {
    let current = supplied || session;
    if (current?.refreshToken && discovery && Date.now() / 1000 >= current.issuedAt + (current.expiresIn || 0) - 60) {
      const refreshed = await AuthSession.refreshAsync({ clientId: CLIENT, refreshToken: current.refreshToken }, discovery);
      current = { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken || current.refreshToken, issuedAt: refreshed.issuedAt, expiresIn: refreshed.expiresIn };
      await saveSession(current);
    }
    const result = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(current ? { Authorization: `Bearer ${current.accessToken}` } : {}) }, body: data === undefined ? undefined : JSON.stringify(data) });
    const body = await result.json();
    if (!result.ok) throw new Error(body.message || 'BOMA is unavailable. Please try again.');
    return body as T;
  }
  async function work(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { SecureStore.getItemAsync(SESSION_KEY).then((value) => { if (value) setSession(JSON.parse(value)); }).catch(() => setError('Please sign in again.')); }, []);
  useEffect(() => {
    if (response?.type !== 'success' || !discovery || !request?.codeVerifier) return;
    const code = response.params.code;
    work(async () => {
      const tokens = await AuthSession.exchangeCodeAsync({ clientId: CLIENT, code, redirectUri, extraParams: { code_verifier: request.codeVerifier! } }, discovery);
      await saveSession({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, issuedAt: tokens.issuedAt, expiresIn: tokens.expiresIn });
    });
  }, [response]); // Exchange each authorization response once; PKCE verifier stays on the request.
  useEffect(() => {
    if (!session) { setProfile(null); return; }
    api<{ user_id: string; roles: string[] }>('/workspace/session').then(setProfile).catch((error) => setError(error.message));
  }, [session?.accessToken]);
  useEffect(() => { work(load); }, [tab, profile?.user_id]);

  async function load() {
    if (tab === 'Explore') setProperties((await api<{ items: Property[] }>('/listings?q=' + encodeURIComponent(query))).items);
    if (tab === 'Saved' && session) setProperties((await api<{ items: Property[] }>('/listings/favorites')).items);
    if (tab === 'Requests' && session) { setInquiries((await api<{ items: Inquiry[] }>('/workspace/inquiries')).items); setStays((await api<{ items: Stay[] }>('/bookings')).items); }
    if (tab === 'Updates' && session) setNotices((await api<{ items: Notice[] }>('/workspace/notifications')).items);
    if (tab === 'Officer' && session) {
      setOfficerProperties((await api<{ items: Property[] }>('/workspace/properties')).items);
      setCases((await api<{ items: Identity[] }>('/workspace/identity-cases')).items);
      setInquiries((await api<{ inquiries: Inquiry[] }>('/workspace/tasks')).inquiries);
    }
  }
  async function signOut() {
    const pushToken = await SecureStore.getItemAsync('boma-push-token');
    if (pushToken) await api('/workspace/devices', 'DELETE', { token: pushToken }).catch(() => undefined);
    await SecureStore.deleteItemAsync('boma-push-token');
    if (session?.refreshToken && discovery?.revocationEndpoint) {
      await AuthSession.revokeAsync({ clientId: CLIENT, token: session.refreshToken }, discovery).catch(() => undefined);
    }
    await SecureStore.deleteItemAsync(SESSION_KEY);
    if (profile) await SecureStore.deleteItemAsync('boma-evidence-' + profile.user_id);
    setSession(null); setProfile(null); setSelected(null); setConversation(null); setNotices([]); setInquiries([]); setCases([]); setStays([]); setOfficerProperties([]); setProperties([]); setMessages([]); setReference(''); setTab('Explore');
  }
  async function pushRegistration() {
    const projectId = process.env.EXPO_PUBLIC_EXPO_PROJECT_ID;
    if (!projectId) throw new Error('Push delivery is awaiting BOMA provider configuration. In-app updates are available.');
    const permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') throw new Error('Notification permission was not granted.');
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api('/workspace/devices', 'POST', { token, provider: 'expo' });
    await SecureStore.setItemAsync('boma-push-token', token);
    Alert.alert('BOMA', 'Device registered. Push delivery awaits provider activation; in-app updates are available.');
  }
  async function requestStay() {
    if (!selected) return;
    const key = bookingKey || Crypto.randomUUID();
    setBookingKey(key);
    await api('/bookings', 'POST', { listing_id: selected.listing_id, check_in: checkIn, check_out: checkOut, guests: Number(guests), idempotency_key: key });
    Alert.alert('BOMA', 'Short-stay request received. The 15-minute hold is not a confirmed booking; no payment was taken.');
  }
  const staff = profile?.roles.some((role) => ['officer', 'regional_supervisor', 'national_admin'].includes(role));
  const tabs = ['Explore', 'Saved', 'Requests', 'Updates', ...(staff ? ['Officer'] : [])];
  return <SafeAreaView style={styles.safe}><View style={styles.header}><Text style={styles.logo}>BOMA</Text><Button label={session ? 'Sign out' : 'Sign in'} disabled={!session && !request} onPress={() => work(async () => { if (session) await signOut(); else await promptAsync(); })} /></View>
    <ScrollView horizontal style={styles.tabs}>{tabs.map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} onPress={() => { setTab(item); setSelected(null); setConversation(null); }} style={[styles.tab, tab === item && styles.active]}><Text style={tab === item ? styles.white : undefined}>{item}</Text></Pressable>)}</ScrollView>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {busy && <ActivityIndicator color="#0f4c5c" />}{!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {!session && tab !== 'Explore' && <Text style={styles.body}>Sign in to use your BOMA workspace.</Text>}
      {conversation ? <View style={styles.card}><Button label="Back to requests" onPress={() => setConversation(null)} /><Text style={styles.heading}>Messages with BOMA</Text>{messages.map((item) => <View style={[styles.message, item.from_me && styles.mine]} key={item.message_id}><Text style={styles.small}>{item.from_me ? 'You' : 'BOMA officer'}</Text><Text>{item.body}</Text></View>)}<TextInput accessibilityLabel="Message to BOMA" style={styles.input} multiline value={message} onChangeText={setMessage} placeholder="Your message to BOMA" /><Button label="Send message" disabled={busy || !message.trim()} onPress={() => work(async () => { await api(`/workspace/inquiries/${conversation.inquiry_id}/messages`, 'POST', { body: message }); setMessage(''); setMessages((await api<{ items: Message[] }>(`/workspace/inquiries/${conversation.inquiry_id}/messages`)).items); })} /></View> : selected ? <View style={styles.card}><Button label="Back to properties" onPress={() => setSelected(null)} /><Text style={styles.heading}>{selected.title}</Text><Text style={styles.badge}>{selected.verification_status === 'VERIFIED' ? '✓ BOMA verified' : 'Unverified property'}</Text><Text>{[selected.district, selected.region].filter(Boolean).join(', ')}</Text><Text style={styles.price}>{Number(selected.price).toLocaleString('en-TZ')} TZS</Text><Text style={styles.body}>BOMA coordinates all questions and physical viewings. Exact locations and owner contact remain private.</Text>{session && <><Button label="Save property" onPress={() => work(async () => { await api(`/listings/${selected.listing_id}/favorite`, 'POST', {}); Alert.alert('BOMA', 'Property saved.'); })} /><Button label="Ask a BOMA officer" onPress={() => work(async () => { await api('/workspace/inquiries', 'POST', { listing_id: selected.listing_id, kind: 'inquiry' }); setSelected(null); setTab('Requests'); })} /><Button label="Request guided viewing" onPress={() => work(async () => { await api('/workspace/inquiries', 'POST', { listing_id: selected.listing_id, kind: 'viewing' }); setSelected(null); setTab('Requests'); })} />{selected.listing_type === 'short_stay' && <View style={styles.card}><Text style={styles.cardTitle}>Request a short stay</Text><TextInput style={styles.input} accessibilityLabel="Check-in date" placeholder="Check-in (YYYY-MM-DD)" value={checkIn} onChangeText={(value) => { setCheckIn(value); setBookingKey(null); }} /><TextInput style={styles.input} accessibilityLabel="Check-out date" placeholder="Check-out (YYYY-MM-DD)" value={checkOut} onChangeText={(value) => { setCheckOut(value); setBookingKey(null); }} /><TextInput style={styles.input} accessibilityLabel="Number of guests" keyboardType="numeric" value={guests} onChangeText={(value) => { setGuests(value); setBookingKey(null); }} /><Button label="Request dates with BOMA" disabled={busy || !checkIn || !checkOut} onPress={() => work(requestStay)} /></View>}</>}</View> : <>
      {(tab === 'Explore' || tab === 'Saved') && <><Text style={styles.heading}>{tab === 'Explore' ? 'Find your place in Tanzania.' : 'Your saved properties'}</Text>{tab === 'Explore' && <><TextInput accessibilityLabel="Search properties" style={styles.input} placeholder="Property title" value={query} onChangeText={setQuery} /><Button label="Search properties" onPress={() => work(load)} /></>}{!busy && properties.length === 0 && <Text style={styles.body}>No properties found.</Text>}{properties.map((item) => <Pressable key={item.listing_id} onPress={() => { setSelected(item); setBookingKey(null); }} style={styles.card} accessibilityRole="button"><Text style={styles.badge}>{item.verification_status}</Text><Text style={styles.cardTitle}>{item.title}</Text><Text>{item.region}</Text><Text style={styles.price}>{Number(item.price).toLocaleString('en-TZ')} TZS</Text></Pressable>)}</>}
      {(tab === 'Requests' || tab === 'Officer') && session && inquiries.map((item) => <View key={item.inquiry_id} style={styles.card}><Text style={styles.cardTitle}>{item.kind} · {item.status}</Text><Text style={styles.small}>Property {item.listing_id}</Text>{item.scheduled_at && <Text>{new Date(item.scheduled_at).toLocaleString('en-TZ', { timeZone: 'Africa/Dar_es_Salaam' })} EAT</Text>}<Button label="Messages with BOMA" onPress={() => work(async () => { setMessages((await api<{ items: Message[] }>(`/workspace/inquiries/${item.inquiry_id}/messages`)).items); setConversation(item); })} /></View>)}
      {tab === 'Requests' && session && <><Text style={styles.heading}>Short-stay requests</Text>{stays.map((stay) => <View key={stay.booking_id} style={styles.card}><Text style={styles.cardTitle}>{stay.check_in} → {stay.check_out}</Text><Text>{stay.guests} guests · {stay.status}</Text>{stay.status === 'requested' && <Button label="Cancel request" onPress={() => work(async () => { await api(`/bookings/${stay.booking_id}/cancel`, 'POST', {}); await load(); })} />}</View>)}</>}
      {tab === 'Updates' && session && <><Button label="Enable push notifications" onPress={() => work(pushRegistration)} />{notices.length === 0 && <Text style={styles.body}>You’re all caught up.</Text>}{notices.map((item) => <View style={styles.card} key={item.notification_id}><Text>{item.body}</Text>{!item.read_at && <Button label="Mark read" onPress={() => work(async () => { await api(`/workspace/notifications/${item.notification_id}/read`, 'POST', {}); await load(); })} />}</View>)}</>}
      {tab === 'Officer' && session && <><Text style={styles.heading}>Officer evidence & reviews</Text><Text style={styles.body}>Only review properties in your assigned area after physical checks. Save unfinished evidence securely on this device.</Text><TextInput style={styles.input} accessibilityLabel="Evidence reference" placeholder="Evidence or identity-check reference" multiline value={reference} onChangeText={setReference} /><View style={styles.row}><Button label="Save offline draft" onPress={() => work(async () => { if (!profile) return; await SecureStore.setItemAsync('boma-evidence-' + profile.user_id, reference); Alert.alert('BOMA', 'Draft saved securely on this device.'); })} /><Button label="Load draft" onPress={() => work(async () => { if (profile) setReference(await SecureStore.getItemAsync('boma-evidence-' + profile.user_id) || ''); })} /></View>{cases.map((item) => <View key={item.case_id} style={styles.card}><Text style={styles.cardTitle}>Owner identity review</Text><Text style={styles.small}>{item.user_id}</Text><Button label="Approve checked identity" disabled={!reference} onPress={() => work(async () => { await api(`/workspace/identity-cases/${item.case_id}/decision`, 'POST', { decision: 'approved', reference }); await load(); })} /></View>)}{officerProperties.map((item) => <View key={item.listing_id} style={styles.card}><Text style={styles.cardTitle}>{item.title}</Text><Text>{item.verification_status}</Text>{item.status === 'published' && item.verification_status !== 'VERIFIED' && <Button label="Record verified property" disabled={!reference} onPress={() => work(async () => { await api(`/workspace/properties/${item.listing_id}/verification`, 'POST', { version: item.version, decision: 'verified', evidence: reference }); await load(); })} />}</View>)}</>}
      <Button label="Refresh" disabled={busy} onPress={() => work(load)} />
      </>}
    </ScrollView>
  </SafeAreaView>;
}
function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) { return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.white}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f6f7' }, header: { padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white' }, logo: { fontSize: 24, fontWeight: '900', color: '#0f4c5c', letterSpacing: 4 }, tabs: { flexGrow: 0, padding: 10 }, tab: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, marginRight: 8, backgroundColor: 'white' }, active: { backgroundColor: '#0f4c5c' }, content: { padding: 18, gap: 14, paddingBottom: 60 }, heading: { fontSize: 28, fontWeight: '700', color: '#0f4c5c', marginBottom: 10 }, card: { backgroundColor: 'white', padding: 20, borderRadius: 18, gap: 10, borderWidth: 1, borderColor: '#dce5e6' }, cardTitle: { fontSize: 18, fontWeight: '600' }, price: { fontSize: 20, color: '#0f4c5c', fontWeight: '700' }, badge: { fontSize: 12, color: '#80531c', fontWeight: '600' }, body: { fontSize: 15, lineHeight: 24, color: '#53676b' }, small: { fontSize: 12, color: '#53676b' }, input: { padding: 14, borderWidth: 1, borderColor: '#bacacc', borderRadius: 10, backgroundColor: 'white', minHeight: 48 }, button: { backgroundColor: '#0f4c5c', padding: 12, borderRadius: 10, marginVertical: 4, alignItems: 'center' }, disabled: { opacity: 0.4 }, white: { color: 'white', fontWeight: '600' }, error: { color: '#a52a20', padding: 10 }, message: { padding: 12, borderRadius: 10, backgroundColor: '#f2f6f7' }, mine: { backgroundColor: '#dcebef' }, row: { gap: 6 },
});
