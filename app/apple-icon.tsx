import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #7c6af7, #4ecdc4)',
                }}
            >
                <span
                    style={{
                        color: 'white',
                        fontSize: 110,
                        fontWeight: 800,
                        fontFamily: 'sans-serif',
                        lineHeight: 1,
                    }}
                >
                    F
                </span>
            </div>
        ),
        { ...size }
    )
}
