"use client";
import React, { useState, useEffect, useRef } from "react";
import styles from "./SpeedReader.module.css";

// Utility functions extracted to reduce component complexity
const formatTimeWithPadding = (minutes, seconds) => {
	const secondsStr = seconds < 10 ? `0${seconds}` : `${seconds}`;
	return `${minutes}:${secondsStr}`;
};

const calculateTimeFromWords = (wordCount, wpm) => {
	const totalTimeInSeconds = (wordCount / wpm) * 60;
	const minutes = Math.floor(totalTimeInSeconds / 60);
	const seconds = Math.round(totalTimeInSeconds % 60);
	return { minutes, seconds };
};

// Function to highlight the optimal reading position (ORP) of a word
// This helps readers focus on the right spot for better reading efficiency
const processWordForDisplay = (word) => {
	if (!word || word.length <= 1) return { before: "", optimal: word, after: "" };

	// For words with 1-4 characters, highlight the first character
	if (word.length <= 4) {
		return {
			before: "",
			optimal: word[0],
			after: word.slice(1),
		};
	}

	// For longer words, find the optimal reading position (about 30% into the word)
	const orpIndex = Math.max(1, Math.min(Math.floor(word.length * 0.3), word.length - 2));

	return {
		before: word.slice(0, orpIndex),
		optimal: word[orpIndex],
		after: word.slice(orpIndex + 1),
	};
};

const SpeedReader = () => {
	// State declarations
	const [text, setText] = useState("");
	const [words, setWords] = useState([]);
	const [currentIndex, setCurrentIndex] = useState(-1);
	const [isPlaying, setIsPlaying] = useState(false);
	const [wpm, setWpm] = useState(300);
	const [estimatedTime, setEstimatedTime] = useState({ minutes: 0, seconds: 0 });
	const [fontSizeLevel, setFontSizeLevel] = useState(2); // 0=small, 1=medium, 2=large
	const [darkMode, setDarkMode] = useState(true);
	const [focusMode, setFocusMode] = useState(false); // New state for focus mode
	const [saveModalOpen, setSaveModalOpen] = useState(false); // For save/load functionality
	const [savedTexts, setSavedTexts] = useState([]); // Store saved texts in local storage
	const [textTitle, setTextTitle] = useState(""); // Title for saving texts
	const timerIdRef = useRef(null);
	const textAreaRef = useRef(null); // Reference to textarea for focus
	const displayAreaRef = useRef(null); // Reference to display area for focus mode

	// Load saved texts from local storage on initial mount
	useEffect(() => {
		const savedItems = localStorage.getItem("omniReaderSavedTexts");
		if (savedItems) {
			try {
				setSavedTexts(JSON.parse(savedItems));
			} catch (e) {
				console.error("Failed to parse saved texts", e);
			}
		}

		// Load user preferences
		const savedWpm = localStorage.getItem("omniReaderWpm");
		if (savedWpm) setWpm(Number(savedWpm));

		const savedDarkMode = localStorage.getItem("omniReaderDarkMode");
		if (savedDarkMode !== null) setDarkMode(savedDarkMode === "true");

		const savedFontSize = localStorage.getItem("omniReaderFontSize");
		if (savedFontSize !== null) setFontSizeLevel(Number(savedFontSize));
	}, []);

	// Save user preferences when they change
	useEffect(() => {
		localStorage.setItem("omniReaderWpm", wpm);
		localStorage.setItem("omniReaderDarkMode", darkMode);
		localStorage.setItem("omniReaderFontSize", fontSizeLevel);
	}, [wpm, darkMode, fontSizeLevel]);

	// Handle text input changes
	const handleTextChange = (e) => {
		const newText = e.target.value;
		setText(newText);
		const newWords = newText.split(/\s+/).filter((word) => word.length > 0);
		setWords(newWords);
		setCurrentIndex(-1);
		setIsPlaying(false);

		// Calculate estimated reading time when text changes
		calculateEstimatedTime(newWords.length, wpm);
	};

	// Calculate estimated reading time based on word count and WPM
	const calculateEstimatedTime = (wordCount, currentWpm) => {
		const time = calculateTimeFromWords(wordCount, currentWpm);
		setEstimatedTime(time);
	};

	// Toggle play/pause functionality
	const togglePlayPause = () => {
		if (isPlaying) {
			setIsPlaying(false);
		} else if (words.length > 0) {
			if (currentIndex === -1 || currentIndex >= words.length) setCurrentIndex(0);
			setIsPlaying(true);
		}
	};

	// Keyboard shortcuts for common actions
	useEffect(() => {
		const handleKeyDown = (e) => {
			// Skip if focused on text input
			if (document.activeElement === textAreaRef.current) return;

			switch (e.code) {
				case "Space": // Play/pause with spacebar
					e.preventDefault();
					togglePlayPause();
					break;
				case "ArrowLeft": // Previous word
					e.preventDefault();
					navigateWords(-1);
					break;
				case "ArrowRight": // Next word
					e.preventDefault();
					navigateWords(1);
					break;
				case "ArrowUp": // Increase speed
					e.preventDefault();
					adjustSpeed(50);
					break;
				case "ArrowDown": // Decrease speed
					e.preventDefault();
					adjustSpeed(-50);
					break;
				case "KeyF": // Toggle focus mode
					e.preventDefault();
					toggleFocusMode();
					break;
				case "Escape": // Exit focus mode
					if (focusMode) {
						e.preventDefault();
						setFocusMode(false);
					}
					break;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isPlaying, words.length, currentIndex, wpm, focusMode]);

	// Adjust reading speed
	const handleWpmChange = (e) => {
		const newWpm = Number(e.target.value);
		setWpm(newWpm);
		calculateEstimatedTime(words.length, newWpm);
	};

	// Speed control with buttons
	const adjustSpeed = (amount) => {
		setWpm((prevWpm) => {
			const newWpm = prevWpm + amount;
			const adjustedWpm = Math.min(Math.max(newWpm, 100), 1500);
			calculateEstimatedTime(words.length, adjustedWpm);
			return adjustedWpm;
		});
	};

	// Navigate through words
	const navigateWords = (direction) => {
		if (words.length === 0) return;

		setCurrentIndex((prev) => {
			const newIndex = prev + direction;
			return Math.max(0, Math.min(newIndex, words.length - 1));
		});

		if (isPlaying && direction < 0) {
			// Stop auto-advance if moving backward
			setIsPlaying(false);
		}
	};

	// Reset to beginning
	const resetToStart = () => {
		setCurrentIndex(0);
		setIsPlaying(false);
	};

	// Jump to end
	const jumpToEnd = () => {
		setCurrentIndex(words.length - 1);
		setIsPlaying(false);
	};

	// Adjust font size
	const adjustFontSize = () => {
		setFontSizeLevel((prev) => (prev + 1) % 3);
	};

	// Toggle dark/light mode
	const toggleTheme = () => {
		setDarkMode((prev) => !prev);
	};

	// Toggle focus mode - hides all UI except the reader
	const toggleFocusMode = () => {
		setFocusMode((prev) => !prev);

		// If entering focus mode, ensure reader is visible
		if (!focusMode && displayAreaRef.current) {
			setTimeout(() => {
				displayAreaRef.current.scrollIntoView({ behavior: "smooth" });
			}, 100);
		}
	};

	// Save current text
	const saveCurrentText = () => {
		if (!text.trim() || !textTitle.trim()) return;

		const newSavedText = {
			id: Date.now().toString(),
			title: textTitle,
			content: text,
			timestamp: new Date().toISOString(),
		};

		const updatedSavedTexts = [...savedTexts, newSavedText];
		setSavedTexts(updatedSavedTexts);
		localStorage.setItem("omniReaderSavedTexts", JSON.stringify(updatedSavedTexts));

		setSaveModalOpen(false);
		setTextTitle("");
	};

	// Load a saved text
	const loadSavedText = (savedText) => {
		setText(savedText.content);
		const newWords = savedText.content.split(/\s+/).filter((word) => word.length > 0);
		setWords(newWords);
		setCurrentIndex(-1);
		setIsPlaying(false);
		calculateEstimatedTime(newWords.length, wpm);
		setSaveModalOpen(false);
	};

	// Delete a saved text
	const deleteSavedText = (id) => {
		const updatedSavedTexts = savedTexts.filter((item) => item.id !== id);
		setSavedTexts(updatedSavedTexts);
		localStorage.setItem("omniReaderSavedTexts", JSON.stringify(updatedSavedTexts));
	};

	// Manage word display timing
	useEffect(() => {
		if (isPlaying && currentIndex < words.length) {
			const interval = 60000 / wpm;
			timerIdRef.current = setTimeout(() => {
				setCurrentIndex((prev) => prev + 1);
			}, interval);
		} else if (currentIndex >= words.length && isPlaying) {
			setIsPlaying(false);
		}
		return () => clearTimeout(timerIdRef.current);
	}, [isPlaying, currentIndex, wpm, words]);

	// Calculate estimated time on initial load and when dependencies change
	useEffect(() => {
		calculateEstimatedTime(words.length, wpm);
	}, [words.length, wpm]);

	// Determine text to display
	let displayText = "Ready";
	let processedWord = { before: "", optimal: "R", after: "eady" };

	if (currentIndex >= 0 && currentIndex < words.length) {
		displayText = words[currentIndex];
		processedWord = processWordForDisplay(displayText);
	} else if (currentIndex >= words.length) {
		processedWord = { before: "End ", optimal: "o", after: "f text" };
	}

	// Calculate progress text
	let progressText = "0/0";
	if (words.length > 0) {
		const displayIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
		progressText = `${displayIndex}/${words.length}`;
	}

	// Format the estimated time for display
	const formattedTime =
		words.length > 0
			? formatTimeWithPadding(estimatedTime.minutes, estimatedTime.seconds)
			: "0:00";

	// Progress percentage calculation
	const progressPercentage =
		words.length > 0 && currentIndex >= 0
			? Math.min((currentIndex / words.length) * 100, 100)
			: 0;

	// Calculate time remaining
	let formattedRemainingTime = formattedTime;
	if (words.length > 0 && currentIndex >= 0) {
		const remainingWords = words.length - Math.max(0, currentIndex);
		const { minutes, seconds } = calculateTimeFromWords(remainingWords, wpm);
		formattedRemainingTime = formatTimeWithPadding(minutes, seconds);
	}

	// Font size classes based on level
	const fontSizeClass = [styles.fontSmall, styles.fontMedium, styles.fontLarge][fontSizeLevel];

	// Theme class for dark/light mode
	const themeClass = darkMode ? styles.darkMode : styles.lightMode;

	// Focus mode class
	const focusModeClass = focusMode ? styles.focusMode : "";

	return (
		<div className={`${styles.speedReader} ${themeClass} ${focusModeClass}`}>
			<h2 className={styles.title}>Omni Speed Reader</h2>

			{/* Display Area with click-to-pause functionality */}
			<div className={styles.displayContainer} ref={displayAreaRef}>
				<div className={styles.displayArea} onClick={togglePlayPause}>
					<div className={styles.focusLine}></div>
					<div className={`${styles.word} ${fontSizeClass}`}>
						<span className={styles.wordBefore}>{processedWord.before}</span>
						<span className={styles.wordOptimal}>{processedWord.optimal}</span>
						<span className={styles.wordAfter}>{processedWord.after}</span>
					</div>

					{focusMode && (
						<button
							className={styles.exitFocusButton}
							onClick={(e) => {
								e.stopPropagation();
								setFocusMode(false);
							}}
							aria-label="Exit focus mode"
						>
							<span className={styles.exitIcon}>✕</span>
						</button>
					)}
				</div>
				<div className={styles.progressBarContainer}>
					<div className={styles.progressBar}>
						<div
							className={styles.progressFill}
							style={{ width: `${progressPercentage}%` }}
						></div>
					</div>
					<div className={styles.progressStats}>
						<div className={styles.statItem}>
							<span className={styles.statLabel}>Progress</span>
							<span className={styles.statValue}>{progressText}</span>
						</div>
						<div className={styles.statItem}>
							<span className={styles.statLabel}>Time</span>
							<span className={styles.statValue}>
								{currentIndex >= 0 ? formattedRemainingTime : formattedTime}
								<span className={styles.timeLabel}>
									{currentIndex >= 0 ? " remaining" : " total"}
								</span>
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* Enhanced Controls Section */}
			<div className={styles.controlsContainer}>
				<div className={styles.controlsToolbar}>
					{/* Navigation Controls */}
					<div className={styles.controlGroup}>
						<button
							className={styles.controlButton}
							onClick={resetToStart}
							aria-label="Reset to beginning"
							title="Reset to beginning (Home)"
						>
							<span className={styles.controlIcon}>⏮</span>
						</button>
						<button
							className={styles.controlButton}
							onClick={() => navigateWords(-10)}
							aria-label="Back 10 words"
							title="Back 10 words (Shift+Left)"
						>
							<span className={styles.controlIcon}>⏪</span>
						</button>
						<button
							className={styles.controlButton}
							onClick={() => navigateWords(-1)}
							aria-label="Previous word"
							title="Previous word (Left Arrow)"
						>
							<span className={styles.controlIcon}>◀</span>
						</button>
					</div>

					{/* Play/Pause Control */}
					<button
						onClick={togglePlayPause}
						className={`${styles.playButton} ${isPlaying ? styles.pauseButton : ""}`}
						title="Play/Pause (Space)"
					>
						{isPlaying ? "Pause" : "Play"}
					</button>

					{/* Forward Navigation Controls */}
					<div className={styles.controlGroup}>
						<button
							className={styles.controlButton}
							onClick={() => navigateWords(1)}
							aria-label="Next word"
							title="Next word (Right Arrow)"
						>
							<span className={styles.controlIcon}>▶</span>
						</button>
						<button
							className={styles.controlButton}
							onClick={() => navigateWords(10)}
							aria-label="Forward 10 words"
							title="Forward 10 words (Shift+Right)"
						>
							<span className={styles.controlIcon}>⏩</span>
						</button>
						<button
							className={styles.controlButton}
							onClick={jumpToEnd}
							aria-label="Jump to end"
							title="Jump to end (End)"
						>
							<span className={styles.controlIcon}>⏭</span>
						</button>
					</div>
				</div>

				{/* Additional Controls and Stats Bar */}
				<div className={styles.statsAndSettings}>
					{/* Left: Speed Controls */}
					<div className={styles.speedControls}>
						<button
							className={styles.speedButton}
							onClick={() => adjustSpeed(-50)}
							aria-label="Decrease speed"
							title="Decrease speed (Down Arrow)"
						>
							−
						</button>
						<div className={styles.sliderContainer}>
							<input
								type="range"
								min="100"
								max="1500"
								step="50"
								value={wpm}
								onChange={handleWpmChange}
								className={styles.slider}
								aria-label="Reading speed"
							/>
							<span className={styles.wpmLabel}>{wpm} wpm</span>
						</div>
						<button
							className={styles.speedButton}
							onClick={() => adjustSpeed(50)}
							aria-label="Increase speed"
							title="Increase speed (Up Arrow)"
						>
							+
						</button>
					</div>

					{/* Right: Display settings */}
					<div className={styles.displaySettings}>
						<button
							className={styles.settingButton}
							onClick={toggleFocusMode}
							aria-label="Toggle focus mode"
							title="Toggle focus mode (F)"
						>
							<span className={styles.settingIcon}>👁️</span>
						</button>
						<button
							className={styles.settingButton}
							onClick={adjustFontSize}
							aria-label="Change font size"
							title="Change font size"
						>
							<span className={styles.settingIcon}>Aa</span>
						</button>
						<button
							className={styles.settingButton}
							onClick={toggleTheme}
							aria-label="Toggle dark/light mode"
							title="Toggle dark/light mode"
						>
							<span className={styles.settingIcon}>{darkMode ? "☀️" : "🌙"}</span>
						</button>
						<button
							className={styles.settingButton}
							onClick={() => setSaveModalOpen(true)}
							aria-label="Save/Load Text"
							title="Save or load text"
						>
							<span className={styles.settingIcon}>💾</span>
						</button>
					</div>
				</div>
			</div>

			{/* Text Input Area */}
			<textarea
				ref={textAreaRef}
				className={styles.textArea}
				value={text}
				onChange={handleTextChange}
				placeholder="Enter your text here to speed read..."
			/>

			{/* Keyboard shortcuts help */}
			<div className={styles.keyboardShortcuts}>
				<button
					className={styles.helpToggle}
					onClick={() =>
						document.getElementById("shortcutsModal").classList.toggle(styles.visible)
					}
					aria-label="Keyboard shortcuts"
				>
					⌨️ Keyboard Shortcuts
				</button>
				<div id="shortcutsModal" className={styles.shortcutsModal}>
					<div className={styles.shortcutsContent}>
						<h3>Keyboard Shortcuts</h3>
						<div className={styles.shortcutGrid}>
							<div className={styles.shortcutItem}>
								<kbd>Space</kbd> Play/Pause
							</div>
							<div className={styles.shortcutItem}>
								<kbd>←</kbd> Previous word
							</div>
							<div className={styles.shortcutItem}>
								<kbd>→</kbd> Next word
							</div>
							<div className={styles.shortcutItem}>
								<kbd>↑</kbd> Increase speed
							</div>
							<div className={styles.shortcutItem}>
								<kbd>↓</kbd> Decrease speed
							</div>
							<div className={styles.shortcutItem}>
								<kbd>F</kbd> Toggle focus mode
							</div>
							<div className={styles.shortcutItem}>
								<kbd>Esc</kbd> Exit focus mode
							</div>
						</div>
						<button
							className={styles.closeButton}
							onClick={() =>
								document
									.getElementById("shortcutsModal")
									.classList.remove(styles.visible)
							}
						>
							Close
						</button>
					</div>
				</div>
			</div>

			{/* Save/Load Modal */}
			{saveModalOpen && (
				<div className={styles.modalOverlay}>
					<div className={styles.modal}>
						<div className={styles.modalHeader}>
							<h3>Save / Load Text</h3>
							<button
								className={styles.closeModalButton}
								onClick={() => setSaveModalOpen(false)}
								aria-label="Close modal"
							>
								✕
							</button>
						</div>

						<div className={styles.modalContent}>
							{/* Save new text section */}
							<div className={styles.saveTextSection}>
								<h4>Save Current Text</h4>
								<input
									type="text"
									placeholder="Enter title for this text"
									value={textTitle}
									onChange={(e) => setTextTitle(e.target.value)}
									className={styles.modalInput}
								/>
								<button
									className={styles.saveButton}
									onClick={saveCurrentText}
									disabled={!text.trim() || !textTitle.trim()}
								>
									Save Text
								</button>
							</div>

							{/* Saved texts list */}
							<div className={styles.savedTextsList}>
								<h4>Your Saved Texts</h4>
								{savedTexts.length === 0 ? (
									<p className={styles.noSavedTexts}>No saved texts yet.</p>
								) : (
									<ul className={styles.textsList}>
										{savedTexts.map((item) => (
											<li key={item.id} className={styles.savedTextItem}>
												<div className={styles.savedTextInfo}>
													<span className={styles.savedTextTitle}>
														{item.title}
													</span>
													<span className={styles.savedTextDate}>
														{new Date(
															item.timestamp
														).toLocaleDateString()}
													</span>
												</div>
												<div className={styles.savedTextActions}>
													<button
														onClick={() => loadSavedText(item)}
														className={styles.loadButton}
														aria-label={`Load ${item.title}`}
													>
														Load
													</button>
													<button
														onClick={() => deleteSavedText(item.id)}
														className={styles.deleteButton}
														aria-label={`Delete ${item.title}`}
													>
														Delete
													</button>
												</div>
											</li>
										))}
									</ul>
								)}
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default SpeedReader;
