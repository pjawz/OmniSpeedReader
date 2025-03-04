import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import PropTypes from "prop-types";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata = {
	title: "Omni Speed Reader",
	description: "Speed reading app to help you read faster",
};

export default function RootLayout({ children }) {
	return (
		<html lang="en">
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				<header className="header">
					<nav className="nav">
						<Link href="/" className="nav-link">
							Omni Speed Reader
						</Link>
					</nav>
				</header>
				{children}
				<footer className="footer">
					<p>&copy; 2025 Omni Speed Reader. All rights reserved.</p>
				</footer>
				<style>{`
					.header {
						background: #f2f2f2;
						padding: 1rem;
					}
					.nav {
						display: flex;
						gap: 1rem;
					}
					.footer {
						text-align: center;
						padding: 1rem;
						background: #f2f2f2;
					}
				`}</style>
			</body>
		</html>
	);
}

RootLayout.propTypes = {
	children: PropTypes.node.isRequired,
};
