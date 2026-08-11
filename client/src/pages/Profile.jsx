import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Camera, User, Mail, Phone, Lock, Building2 } from "lucide-react";
import { COLORS } from "../theme";
import { useAuth } from "../context/AuthContext";
import { ErrorBanner } from "../components/Shared";
import { api } from "../api";

const MAX_AVATAR_BYTES = 1_200_000;

export default function Profile() {
  const { user, updateSession } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [avatarError, setAvatarError] = useState("");
  const [savingAvatar, setSavingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  if (!user) return null;

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");

    if (!file.type.startsWith("image/")) {
      setAvatarError("Escolha um arquivo de imagem (JPG, PNG ou WEBP).");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("Imagem muito grande. Escolha um arquivo de até 1,2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      setSavingAvatar(true);
      try {
        const data = await api.updateAvatar(reader.result);
        updateSession(data);
      } catch (err) {
        setAvatarError(err.message);
      } finally {
        setSavingAvatar(false);
      }
    };
    reader.onerror = () => setAvatarError("Não foi possível ler essa imagem. Tente outra.");
    reader.readAsDataURL(file);
  }

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setSavingProfile(true);
    try {
      const data = await api.updateProfile({ name, email, phone });
      updateSession(data);
      setProfileSuccess("Dados atualizados.");
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    setSavingPassword(true);
    try {
      await api.updatePassword(currentPassword, newPassword);
      setPasswordSuccess("Senha alterada com sucesso.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setSavingPassword(false);
    }
  }

  const roleLabel = { admin: "Administrador", fazenda: "Fazenda", investidor: "Investidor" }[user.role];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, color: COLORS.soil, margin: "0 0 4px" }}>Seu perfil</h1>
      <p style={{ fontSize: 13.5, color: COLORS.soilLight, margin: "0 0 24px" }}>
        {roleLabel} · gerencie seus dados de contato, foto e senha.
      </p>

      {/* Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 26 }}>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={savingAvatar}
          style={{
            width: 80, height: 80, borderRadius: 18, background: "#fff", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", padding: 0,
            boxShadow: "0 2px 8px rgba(58,46,34,0.1)", flexShrink: 0,
          }}
          title="Trocar foto de perfil"
        >
          {user.avatar_data ? (
            <img src={user.avatar_data} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <User size={34} color={COLORS.clay} />
          )}
          <div style={{
            position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: "50%",
            background: COLORS.orange, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff",
          }}>
            <Camera size={12} color="#fff" />
          </div>
        </button>
        <div>
          <p style={{ fontWeight: 600, fontSize: 15, color: COLORS.soil, margin: 0, fontFamily: "'Baloo 2', cursive" }}>{user.name}</p>
          <p style={{ fontSize: 12.5, color: COLORS.soilLight, margin: "2px 0 0" }}>{savingAvatar ? "Enviando foto..." : "Toque na foto para trocar"}</p>
        </div>
      </div>
      {avatarError && <ErrorBanner message={avatarError} />}

      {user.role === "fazenda" && (
        <Link to="/fazenda" style={{
          display: "flex", alignItems: "center", gap: 8, background: COLORS.bgCard, border: `1px solid ${COLORS.line}`,
          borderRadius: 12, padding: "12px 16px", marginBottom: 24, textDecoration: "none", color: COLORS.soil, fontSize: 13.5, fontWeight: 500,
        }}>
          <Building2 size={16} /> Ir para o painel da fazenda
        </Link>
      )}

      {/* Dados de contato */}
      <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.soil, margin: "0 0 14px" }}>Dados de contato</p>
        <ErrorBanner message={profileError} />
        {profileSuccess && <p style={{ fontSize: 12.5, color: COLORS.leaf, marginBottom: 12 }}>{profileSuccess}</p>}
        <form onSubmit={handleProfileSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <TextField icon={User} label="Nome completo" value={name} onChange={setName} required />
          <TextField icon={Mail} label="E-mail" type="email" value={email} onChange={setEmail} required />
          <TextField icon={Phone} label="Telefone / WhatsApp" value={phone} onChange={setPhone} placeholder="(00) 00000-0000" />
          <button type="submit" disabled={savingProfile} style={{
            marginTop: 4, padding: "11px 0", borderRadius: 10, border: "none", background: COLORS.orange,
            color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: savingProfile ? 0.7 : 1,
          }}>
            {savingProfile ? "Salvando..." : "Salvar dados"}
          </button>
        </form>
      </div>

      {/* Senha */}
      <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.soil, margin: "0 0 14px" }}>Alterar senha</p>
        <ErrorBanner message={passwordError} />
        {passwordSuccess && <p style={{ fontSize: 12.5, color: COLORS.leaf, marginBottom: 12 }}>{passwordSuccess}</p>}
        <form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <TextField icon={Lock} label="Senha atual" type="password" value={currentPassword} onChange={setCurrentPassword} required />
          <TextField icon={Lock} label="Nova senha (mínimo 8 caracteres)" type="password" value={newPassword} onChange={setNewPassword} required minLength={8} />
          <button type="submit" disabled={savingPassword} style={{
            marginTop: 4, padding: "11px 0", borderRadius: 10, border: `1px solid ${COLORS.line}`, background: "#fff",
            color: COLORS.soil, fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: savingPassword ? 0.7 : 1,
          }}>
            {savingPassword ? "Alterando..." : "Alterar senha"}
          </button>
        </form>
      </div>
    </div>
  );
}

function TextField({ icon: Icon, label, value, onChange, type = "text", required, minLength, placeholder }) {
  return (
    <div>
      <label style={{ fontSize: 11.5, color: COLORS.soilLight, display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
        <Icon size={12} /> {label}
      </label>
      <input
        type={type} required={required} minLength={minLength} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${COLORS.line}`, fontSize: 14, background: "#fff" }}
      />
    </div>
  );
}
