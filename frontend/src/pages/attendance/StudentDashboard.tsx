import { useEffect, useState } from "react";

interface Session {
    id: number;
    course_id: number;
    course_code: string;
    course_name: string;
    session_date: string;
    start_time: string;
    end_time: string;
    qr_token: string;
    is_active: boolean;
}

const API_URL = "http://localhost:5000";

export default function StudentDashboard() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchSessions();
    }, []);

    async function fetchSessions() {
        try {
            setLoading(true);
            setError("");

            const response = await fetch(
                `${API_URL}/api/attendance/sessions`
            );

            if (!response.ok) {
                throw new Error("Failed to load attendance sessions");
            }

            const data = await response.json();

            setSessions(data);
        } catch (err) {
            console.error(err);
            setError("Unable to load attendance sessions.");
        } finally {
            setLoading(false);
        }
    }

    function openScanner(sessionId: number) {
        window.location.href = `/attendance/scan?session=${sessionId}`;
    }

    return (
        <div style={styles.page}>
            <div style={styles.container}>
                <div style={styles.header}>
                    <div>
                        <h1 style={styles.title}>Student Dashboard</h1>
                        <p style={styles.subtitle}>
                            View your classes and mark your attendance.
                        </p>
                    </div>

                    <button
                        onClick={fetchSessions}
                        style={styles.refreshButton}
                    >
                        Refresh
                    </button>
                </div>

                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>Available Classes</h2>

                    {loading && (
                        <p style={styles.message}>
                            Loading attendance sessions...
                        </p>
                    )}

                    {error && (
                        <p style={styles.error}>
                            {error}
                        </p>
                    )}

                    {!loading && !error && sessions.length === 0 && (
                        <p style={styles.message}>
                            No attendance sessions available.
                        </p>
                    )}

                    <div style={styles.grid}>
                        {sessions.map((session) => (
                            <div
                                key={session.id}
                                style={styles.card}
                            >
                                <div style={styles.cardTop}>
                                    <div>
                                        <h3 style={styles.courseCode}>
                                            {session.course_code}
                                        </h3>

                                        <p style={styles.courseName}>
                                            {session.course_name}
                                        </p>
                                    </div>

                                    <span
                                        style={{
                                            ...styles.status,
                                            ...(session.is_active
                                                ? styles.active
                                                : styles.inactive),
                                        }}
                                    >
                                        {session.is_active
                                            ? "Active"
                                            : "Closed"}
                                    </span>
                                </div>

                                <div style={styles.details}>
                                    <p>
                                        <strong>Date:</strong>{" "}
                                        {new Date(
                                            session.session_date
                                        ).toLocaleDateString()}
                                    </p>

                                    <p>
                                        <strong>Time:</strong>{" "}
                                        {session.start_time} -{" "}
                                        {session.end_time}
                                    </p>
                                </div>

                                <button
                                    disabled={!session.is_active}
                                    onClick={() =>
                                        openScanner(session.id)
                                    }
                                    style={{
                                        ...styles.scanButton,
                                        ...(session.is_active
                                            ? {}
                                            : styles.disabledButton),
                                    }}
                                >
                                    {session.is_active
                                        ? "Scan QR Code"
                                        : "Session Closed"}
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: "100vh",
        background: "#f5f7fa",
        padding: "40px 20px",
        fontFamily: "Arial, sans-serif",
    },

    container: {
        maxWidth: "1100px",
        margin: "0 auto",
    },

    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "40px",
    },

    title: {
        margin: 0,
        fontSize: "32px",
    },

    subtitle: {
        marginTop: "8px",
        color: "#666",
    },

    refreshButton: {
        padding: "10px 18px",
        border: "1px solid #ccc",
        borderRadius: "8px",
        background: "#fff",
        cursor: "pointer",
    },

    section: {
        background: "#fff",
        padding: "25px",
        borderRadius: "14px",
    },

    sectionTitle: {
        marginTop: 0,
        marginBottom: "20px",
    },

    grid: {
        display: "grid",
        gridTemplateColumns:
            "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "20px",
    },

    card: {
        border: "1px solid #e2e5e9",
        borderRadius: "12px",
        padding: "20px",
    },

    cardTop: {
        display: "flex",
        justifyContent: "space-between",
        gap: "15px",
    },

    courseCode: {
        margin: 0,
        fontSize: "20px",
    },

    courseName: {
        color: "#666",
        marginTop: "6px",
    },

    status: {
        height: "fit-content",
        padding: "5px 10px",
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: 600,
    },

    active: {
        background: "#e7f7ed",
        color: "#16833a",
    },

    inactive: {
        background: "#f1f1f1",
        color: "#777",
    },

    details: {
        margin: "20px 0",
        color: "#555",
        fontSize: "14px",
    },

    scanButton: {
        width: "100%",
        padding: "12px",
        border: "none",
        borderRadius: "8px",
        background: "#111",
        color: "#fff",
        cursor: "pointer",
        fontWeight: 600,
    },

    disabledButton: {
        background: "#ccc",
        cursor: "not-allowed",
    },

    message: {
        color: "#666",
    },

    error: {
        color: "#c62828",
    },
};