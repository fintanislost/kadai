# Homebrew formula template for kadai. Submit to a tap (e.g., owner/homebrew-tap)
# or homebrew-core when ready. Replace REPLACE_WITH_* placeholders before publishing.
class Kadai < Formula
  desc "Local-first product spine for projects driven by agentic coding"
  homepage "https://github.com/fintanislost/kadai"
  version "REPLACE_WITH_VERSION"

  on_macos do
    on_arm do
      url "https://github.com/fintanislost/kadai/releases/download/v#{version}/kadai-darwin-arm64"
      sha256 "REPLACE_WITH_DARWIN_ARM64_SHA256"
    end
    on_intel do
      url "https://github.com/fintanislost/kadai/releases/download/v#{version}/kadai-darwin-x64"
      sha256 "REPLACE_WITH_DARWIN_X64_SHA256"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/fintanislost/kadai/releases/download/v#{version}/kadai-linux-arm64"
      sha256 "REPLACE_WITH_LINUX_ARM64_SHA256"
    end
    on_intel do
      url "https://github.com/fintanislost/kadai/releases/download/v#{version}/kadai-linux-x64"
      sha256 "REPLACE_WITH_LINUX_X64_SHA256"
    end
  end

  def install
    binary_name = "kadai-#{OS.mac? ? "darwin" : "linux"}-#{Hardware::CPU.arm? ? "arm64" : "x64"}"
    bin.install binary_name => "kadai"
  end

  test do
    assert_match "kadai", shell_output("#{bin}/kadai --version")
  end
end
