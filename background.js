require('dotenv').config(); // Import dotenv and load .env file

const API_KEY = process.env.API_KEY; // Access the API key

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "docuSummarizer",
    title: "Summarize with Documentation Summarizer",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "docuSummarizer" && info.selectionText) {
    const selectedText = info.selectionText;

    try {
      // Show loader before fetching data
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const existingLoader = document.getElementById(
            "docuSummarizerLoader"
          );
          if (existingLoader) return;

          const loader = document.createElement("div");
          loader.id = "docuSummarizerLoader";
          loader.style.position = "fixed";
          loader.style.top = "50%";
          loader.style.left = "50%";
          loader.style.transform = "translate(-50%, -50%)";
          loader.style.zIndex = "10000";
          loader.style.padding = "20px";
          loader.style.background = "rgba(0, 0, 0, 0.8)";
          loader.style.color = "#fff";
          loader.style.borderRadius = "8px";
          loader.style.textAlign = "center";
          loader.textContent = "Summarizing...";
          document.body.appendChild(loader);
        },
      });

      // Fetch summarized content
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Summarize the following text: "${selectedText}". Provide the following details in a beginner-friendly manner:

                        Summary: A concise overview of the topic or problem explained in simple, easy-to-understand language.
Definition: A clear and straightforward explanation of the concept, problem, or topic.
Example Use Cases:
If the text describes a coding concept or theory, include simple, beginner-friendly examples demonstrating its use.
If the text contains a coding problem, provide a step-by-step solution with code examples in C, C++, and Python, explained in detail for clarity also explain eaxh line of code.
Time and Space Complexity:
If the text pertains to an algorithm or computational problem, include its time complexity and space complexity, with a brief explanation of how they are derived.
Ensure the response is structured, easy to read, and suitable for developers at all skill level and always explain each line of code`,
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!response.ok) throw new Error("API Error: " + response.status);

      const data = await response.json();
      const rawResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      // Extracting code snippets using regex
      const codeRegex = /```([\s\S]+?)```/g;
      let codeMatches;
      const codeExamples = [];

      while ((codeMatches = codeRegex.exec(rawResponse)) !== null) {
        codeExamples.push(codeMatches[1]);
      }

      // Extracting text response excluding code
      const textResponse = rawResponse.replace(codeRegex, "");

      if (codeExamples.length === 0) {
        throw new Error("No code examples found.");
      }

      // Remove loader and show the result in a floating window
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (codeExamples, textResponse) => {
          const existingLoader = document.getElementById(
            "docuSummarizerLoader"
          );
          if (existingLoader) existingLoader.remove();

          const existingWindow = document.getElementById(
            "docuSummarizerWindow"
          );
          if (existingWindow) existingWindow.remove();

          const floatingWindow = document.createElement("div");
          floatingWindow.id = "docuSummarizerWindow";
          floatingWindow.style.position = "fixed";
          floatingWindow.style.top = "50px";
          floatingWindow.style.right = "50px";
          floatingWindow.style.width = "400px";
          floatingWindow.style.height = "auto";
          floatingWindow.style.overflow = "auto";
          floatingWindow.style.zIndex = "10000";
          floatingWindow.style.padding = "15px";
          floatingWindow.style.background = "#f8f9fa";
          floatingWindow.style.border = "1px solid #ccc";
          floatingWindow.style.borderRadius = "8px";
          floatingWindow.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.1)";
          floatingWindow.style.resize = "both"; // Allow resizing
          floatingWindow.style.minWidth = "200px";
          floatingWindow.style.minHeight = "200px";
          floatingWindow.style.maxWidth = "600px";
          floatingWindow.style.maxHeight = "80vh";

          const createSection = (title, content) => {
            const section = document.createElement("div");
            section.style.marginBottom = "20px";
            section.style.padding = "15px";
            section.style.background = "#ffffff";
            section.style.border = "1px solid #ddd";
            section.style.borderRadius = "8px";
            section.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";

            const heading = document.createElement("p");
            heading.style.fontSize = "18px";
            heading.style.fontWeight = "bold";
            heading.style.color = "#333";
            heading.style.marginBottom = "10px";
            heading.textContent = title;
            section.appendChild(heading);

            const paragraph = document.createElement("p");
            paragraph.style.fontSize = "16px";
            paragraph.style.lineHeight = "1.8";
            paragraph.style.color = "#555";
            paragraph.style.textAlign = "justify";
            paragraph.style.fontFamily = "'Roboto', Arial, sans-serif";
            paragraph.innerHTML = formatContent(content);
            section.appendChild(paragraph);

            return section;
          };

          // Function to format content with bold/italic styling
          const formatContent = (content) => {
            if (!content) return "No information provided.";
            return content
              .replace(/(\*\*([^*]+)\*\*)/g, "<b>$2</b>") // Bold with **text**
              .replace(/(\*([^*]+)\*)/g, "<i>$2</i>") // Italic with *text*
              .replace(/(__([^_]+)__)/g, "<u>$2</u>"); // Underline with __text__
          };

          // Regex patterns to extract sections
          const summaryMatch = textResponse.match(/Summary:\s*(.+?)(?=Definition:|Example Use Cases:|Step-by-step Solution:|$)/is);
          const definitionMatch = textResponse.match(/Definition:\s*(.+?)(?=Example Use Cases:|Step-by-step Solution:|$)/is);
          const useCasesMatch = textResponse.match(/Example Use Cases:\s*(.+?)(?=Step-by-step Solution:|$)/is);
          const solutionMatch = textResponse.match(/Step-by-step Solution with Code Examples:\s*(.+)$/is);

          // Extracted content
          const summary = summaryMatch ? summaryMatch[1].trim() : null;
          const definition = definitionMatch ? definitionMatch[1].trim() : null;
          const useCases = useCasesMatch ? useCasesMatch[1].trim() : null;
          const solution = solutionMatch ? solutionMatch[1].trim() : null;

          // Add sections to the floating window
          floatingWindow.appendChild(createSection("Summary", summary));
          floatingWindow.appendChild(createSection("Definition", definition));
          floatingWindow.appendChild(createSection("Example Use Cases", useCases));
          floatingWindow.appendChild(createSection("Step-by-step Solution with Code Examples", solution));

          // Loop through the code examples and create a copyable section
          codeExamples.forEach((code) => {
            const codeSection = document.createElement("div");
            codeSection.style.position = "relative";
            codeSection.style.marginTop = "10px";
            codeSection.style.border = "1px solid #ddd";
            codeSection.style.borderRadius = "4px";
            codeSection.style.background = "#f5f5f5";

            const copyButton = document.createElement("button");
            copyButton.textContent = "Copy";
            copyButton.style.position = "absolute";
            copyButton.style.top = "5px";
            copyButton.style.right = "5px";
            copyButton.style.background = "#007bff";
            copyButton.style.color = "white";
            copyButton.style.border = "none";
            copyButton.style.borderRadius = "4px";
            copyButton.style.padding = "2px 6px";
            copyButton.style.cursor = "pointer";

            copyButton.onclick = () => {
              navigator.clipboard
                .writeText(code)
                .then(() => {
                  alert("Code copied to clipboard!");
                })
                .catch((err) => {
                  console.error("Failed to copy code:", err);
                });
            };

            const pre = document.createElement("pre");
            pre.style.margin = "0";
            pre.style.padding = "10px";
            pre.style.overflowX = "auto";
            pre.style.whiteSpace = "pre-wrap";
            const codeEl = document.createElement("code");
            codeEl.textContent = code;
            pre.appendChild(codeEl);

            codeSection.appendChild(copyButton);
            codeSection.appendChild(pre);
            floatingWindow.appendChild(codeSection);
          });

          const closeButton = document.createElement("button");
          closeButton.textContent = "Close";
          closeButton.style.position = "absolute";
          closeButton.style.top = "5px";
          closeButton.style.right = "10px";
          closeButton.style.background = "red";
          closeButton.style.color = "white";
          closeButton.style.border = "none";
          closeButton.style.borderRadius = "4px";
          closeButton.style.padding = "5px 10px";
          closeButton.style.cursor = "pointer";
          closeButton.onclick = () => floatingWindow.remove();

          floatingWindow.appendChild(closeButton);
          document.body.appendChild(floatingWindow);
        },
        args: [codeExamples, textResponse],
      });
    } catch (error) {
      console.error("Error fetching summary:", error);
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          alert("Failed to fetch the summary. Please try again.");
        },
      });
    }
  }
});
