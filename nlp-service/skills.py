"""
Skill taxonomy used for skill extraction.

Each canonical skill maps to:
  - category: used for grouping in the UI ("soft" skills are shown but not scored)
  - aliases:  every way the skill is commonly written (matched case-insensitively)
  - cs:       aliases that must match with exact case (short/ambiguous words like "Go", "R", "C")
  - list:     names that are also everyday English words ("Go", "Express"): only
              matched inside a list, i.e. next to a comma, slash, pipe or bracket
  - implies:  skills you automatically know if you know this one
              (e.g. Spring Boot -> Java). Only applied to the resume side.

To add a skill, add one entry here. No other code changes are needed.
"""

SKILLS = {
    # ---------------- Programming languages ----------------
    "Python": {"category": "language", "aliases": ["python", "python3"]},
    "Java": {"category": "language", "aliases": ["java", "core java", "java 8", "java 17"]},
    "C++": {"category": "language", "aliases": ["c++", "cpp"]},
    "C": {"category": "language", "aliases": ["c programming", "c language"], "cs": ["C"]},
    "C#": {"category": "language", "aliases": ["c#", "csharp", "c sharp"]},
    "JavaScript": {"category": "language", "aliases": ["javascript", "es6", "ecmascript"], "cs": ["JS"]},
    "TypeScript": {"category": "language", "aliases": ["typescript"]},
    "Go": {"category": "language", "aliases": ["golang", "go lang"], "list": ["Go"]},
    "Rust": {"category": "language", "aliases": [], "cs": ["RUST"], "list": ["Rust"]},
    "Kotlin": {"category": "language", "aliases": ["kotlin"]},
    "Swift": {"category": "language", "aliases": ["swiftui"], "cs": ["SWIFT"], "list": ["Swift"]},
    "R": {"category": "language", "aliases": ["r programming", "r language"], "cs": ["R"]},
    "PHP": {"category": "language", "aliases": ["php"]},
    "Ruby": {"category": "language", "aliases": ["ruby"]},
    "Scala": {"category": "language", "aliases": ["scala"]},
    "Dart": {"category": "language", "aliases": ["dart"]},
    "MATLAB": {"category": "language", "aliases": ["matlab"]},
    "Bash": {"category": "language", "aliases": ["bash", "shell scripting", "shell script"]},
    "SQL": {"category": "database", "aliases": ["sql", "structured query language", "pl/sql", "plsql", "t-sql"]},

    # ---------------- Frontend ----------------
    "HTML": {"category": "frontend", "aliases": ["html", "html5"]},
    "CSS": {"category": "frontend", "aliases": ["css", "css3"]},
    "React": {"category": "frontend", "aliases": ["react.js", "reactjs", "react js"], "cs": ["React", "REACT"], "implies": ["JavaScript"]},
    "Next.js": {"category": "frontend", "aliases": ["next.js", "nextjs", "next js"], "implies": ["React", "JavaScript"]},
    "Angular": {"category": "frontend", "aliases": ["angular", "angularjs", "angular.js"], "implies": ["TypeScript"]},
    "Vue.js": {"category": "frontend", "aliases": ["vue", "vue.js", "vuejs"], "implies": ["JavaScript"]},
    "Redux": {"category": "frontend", "aliases": ["redux", "redux toolkit"]},
    "Tailwind CSS": {"category": "frontend", "aliases": ["tailwind", "tailwind css", "tailwindcss"], "implies": ["CSS"]},
    "Bootstrap": {"category": "frontend", "aliases": ["bootstrap"]},
    "jQuery": {"category": "frontend", "aliases": ["jquery"]},

    # ---------------- Backend ----------------
    "Node.js": {"category": "backend", "aliases": ["node.js", "nodejs", "node js"], "implies": ["JavaScript"]},
    "Express.js": {"category": "backend", "aliases": ["express.js", "expressjs"], "cs": ["EXPRESS"], "list": ["Express"], "implies": ["Node.js"]},
    "Spring Boot": {"category": "backend", "aliases": ["spring boot", "springboot", "spring framework", "spring mvc"], "implies": ["Java"]},
    "Hibernate": {"category": "backend", "aliases": ["hibernate", "jpa"], "implies": ["Java"]},
    "Django": {"category": "backend", "aliases": ["django"], "implies": ["Python"]},
    "Flask": {"category": "backend", "aliases": ["flask", "python flask"], "implies": ["Python"]},
    "FastAPI": {"category": "backend", "aliases": ["fastapi", "fast api"], "implies": ["Python"]},
    ".NET": {"category": "backend", "aliases": [".net", "dotnet", "asp.net", ".net core"], "implies": ["C#"]},
    "REST API": {"category": "backend", "aliases": ["rest api", "rest apis", "restful", "restful api", "restful apis", "restful services"], "cs": ["REST"]},
    "GraphQL": {"category": "backend", "aliases": ["graphql"]},
    "Microservices": {"category": "backend", "aliases": ["microservice", "microservices", "micro-services", "micro services"]},
    "API Gateway": {"category": "backend", "aliases": ["api gateway"]},
    "JWT": {"category": "backend", "aliases": ["jwt", "json web token", "json web tokens"]},
    "OAuth": {"category": "backend", "aliases": ["oauth", "oauth2", "oauth 2.0"]},
    "WebSocket": {"category": "backend", "aliases": ["websocket", "websockets", "socket.io"]},

    # ---------------- Databases ----------------
    "MySQL": {"category": "database", "aliases": ["mysql"], "implies": ["SQL"]},
    "PostgreSQL": {"category": "database", "aliases": ["postgresql", "postgres"], "implies": ["SQL"]},
    "Oracle DB": {"category": "database", "aliases": ["oracle db", "oracle database", "oracle sql"], "implies": ["SQL"]},
    "SQL Server": {"category": "database", "aliases": ["sql server", "mssql", "ms sql"], "implies": ["SQL"]},
    "SQLite": {"category": "database", "aliases": ["sqlite"], "implies": ["SQL"]},
    "MongoDB": {"category": "database", "aliases": ["mongodb", "mongo db", "mongo", "mongoose"]},
    "Redis": {"category": "database", "aliases": ["redis"]},
    "Firebase": {"category": "database", "aliases": ["firebase", "firestore"]},
    "Cassandra": {"category": "database", "aliases": ["cassandra"]},
    "DynamoDB": {"category": "database", "aliases": ["dynamodb"]},
    "Elasticsearch": {"category": "database", "aliases": ["elasticsearch", "elastic search"]},
    "DBMS": {"category": "cs-fundamentals", "aliases": ["dbms", "database management system", "database management systems"]},

    # ---------------- Cloud & DevOps ----------------
    "AWS": {"category": "cloud", "aliases": ["aws", "amazon web services", "ec2", "s3", "aws lambda"]},
    "Azure": {"category": "cloud", "aliases": ["azure", "microsoft azure"]},
    "GCP": {"category": "cloud", "aliases": ["gcp", "google cloud", "google cloud platform"]},
    "Docker": {"category": "devops", "aliases": ["docker", "docker compose", "docker-compose", "containerization", "containerized"]},
    "Kubernetes": {"category": "devops", "aliases": ["kubernetes", "k8s"]},
    "Jenkins": {"category": "devops", "aliases": ["jenkins"]},
    "CI/CD": {"category": "devops", "aliases": ["ci/cd", "ci cd", "continuous integration", "continuous deployment", "github actions"]},
    "Terraform": {"category": "devops", "aliases": ["terraform"]},
    "Linux": {"category": "devops", "aliases": ["linux", "unix", "ubuntu"]},
    "Git": {"category": "tools", "aliases": ["git", "github", "gitlab", "version control"]},
    "Kafka": {"category": "backend", "aliases": ["kafka", "apache kafka"]},
    "RabbitMQ": {"category": "backend", "aliases": ["rabbitmq", "rabbit mq"]},
    "Nginx": {"category": "devops", "aliases": ["nginx"]},
    "Prometheus": {"category": "devops", "aliases": ["prometheus"]},
    "Grafana": {"category": "devops", "aliases": ["grafana"]},

    # ---------------- Data / AI / ML ----------------
    "Machine Learning": {"category": "ai-ml", "aliases": ["machine learning", "ml", "ai/ml"]},
    "Deep Learning": {"category": "ai-ml", "aliases": ["deep learning", "neural network", "neural networks", "cnn", "rnn", "lstm"]},
    "Artificial Intelligence": {"category": "ai-ml", "aliases": ["artificial intelligence", "ai/ml"], "cs": ["AI"]},
    "NLP": {"category": "ai-ml", "aliases": ["nlp", "natural language processing"]},
    "Computer Vision": {"category": "ai-ml", "aliases": ["computer vision", "opencv", "image processing"]},
    "Generative AI": {"category": "ai-ml", "aliases": ["generative ai", "genai", "gen ai", "llm", "llms", "large language model", "large language models", "prompt engineering", "rag"]},
    "TensorFlow": {"category": "ai-ml", "aliases": ["tensorflow", "keras"], "implies": ["Python", "Deep Learning"]},
    "PyTorch": {"category": "ai-ml", "aliases": ["pytorch", "torch"], "implies": ["Python", "Deep Learning"]},
    "Scikit-learn": {"category": "ai-ml", "aliases": ["scikit-learn", "sklearn", "scikit learn"], "implies": ["Python", "Machine Learning"]},
    "Pandas": {"category": "data", "aliases": ["pandas"], "implies": ["Python"]},
    "NumPy": {"category": "data", "aliases": ["numpy"], "implies": ["Python"]},
    "Matplotlib": {"category": "data", "aliases": ["matplotlib", "seaborn"], "implies": ["Python"]},
    "Data Analysis": {"category": "data", "aliases": ["data analysis", "data analytics", "exploratory data analysis", "eda", "data-driven insights"]},
    "Data Visualization": {"category": "data", "aliases": ["data visualization", "data visualisation", "dashboards", "dashboard"]},
    "Statistics": {"category": "data", "aliases": ["statistics", "statistical analysis", "probability"]},
    "Power BI": {"category": "data", "aliases": ["power bi", "powerbi"], "implies": ["Data Visualization"]},
    "Tableau": {"category": "data", "aliases": ["tableau"], "implies": ["Data Visualization"]},
    "Excel": {"category": "data", "aliases": ["excel", "ms excel", "microsoft excel", "advanced excel", "vlookup", "pivot tables"]},
    "ETL": {"category": "data", "aliases": ["etl", "data pipeline", "data pipelines", "elt"]},
    "Apache Spark": {"category": "data", "aliases": ["apache spark", "pyspark"], "list": ["Spark"]},
    "Hadoop": {"category": "data", "aliases": ["hadoop", "hdfs", "apache hive"]},
    "Airflow": {"category": "data", "aliases": ["airflow", "apache airflow"]},
    "Big Data": {"category": "data", "aliases": ["big data"]},

    # ---------------- Mobile ----------------
    "Android": {"category": "mobile", "aliases": ["android", "android development"]},
    "Flutter": {"category": "mobile", "aliases": ["flutter"], "implies": ["Dart"]},
    "React Native": {"category": "mobile", "aliases": ["react native"], "implies": ["React", "JavaScript"]},
    "iOS": {"category": "mobile", "aliases": ["ios development"], "cs": ["iOS"]},

    # ---------------- CS fundamentals ----------------
    "Data Structures": {"category": "cs-fundamentals", "aliases": ["data structures", "data structure", "dsa", "data structures and algorithms"]},
    "Algorithms": {"category": "cs-fundamentals", "aliases": ["algorithms", "algorithm design", "dsa", "data structures and algorithms"]},
    "OOP": {"category": "cs-fundamentals", "aliases": ["oop", "oops", "object oriented programming", "object-oriented programming", "object oriented", "object-oriented"]},
    "Operating Systems": {"category": "cs-fundamentals", "aliases": ["operating systems", "operating system"], "cs": ["OS"]},
    "Computer Networks": {"category": "cs-fundamentals", "aliases": ["computer networks", "computer networking", "tcp/ip"]},
    "System Design": {"category": "cs-fundamentals", "aliases": ["system design", "low level design", "high level design", "lld", "hld"]},
    "Distributed Systems": {"category": "cs-fundamentals", "aliases": ["distributed systems", "distributed system", "distributed computing"]},
    "Design Patterns": {"category": "cs-fundamentals", "aliases": ["design patterns", "design pattern", "solid principles"]},
    "Software Testing": {"category": "tools", "aliases": ["software testing", "unit testing", "junit", "pytest", "jest", "selenium", "test automation"]},
    "Agile": {"category": "tools", "aliases": ["agile", "scrum", "jira"]},
    "Cyber Security": {"category": "security", "aliases": ["cyber security", "cybersecurity", "information security", "network security"]},
    "Blockchain": {"category": "other", "aliases": ["blockchain", "solidity", "web3"]},
    "Figma": {"category": "tools", "aliases": ["figma"]},
    "UI/UX": {"category": "tools", "aliases": ["ui/ux", "ui ux", "user interface design", "user experience"]},
    "SAP": {"category": "other", "aliases": ["sap", "sap abap", "abap"]},
    "Salesforce": {"category": "other", "aliases": ["salesforce"]},

    # ---------------- Soft skills (shown, not scored) ----------------
    "Communication": {"category": "soft", "aliases": ["communication", "communication skills", "verbal and written communication"]},
    "Problem Solving": {"category": "soft", "aliases": ["problem solving", "problem-solving", "analytical skills", "analytical thinking"]},
    "Teamwork": {"category": "soft", "aliases": ["teamwork", "team work", "team player", "team collaboration", "collaboration"]},
    "Leadership": {"category": "soft", "aliases": ["leadership"]},
    "Adaptability": {"category": "soft", "aliases": ["adaptability", "adaptable", "quick learner"]},
}

SOFT_CATEGORY = "soft"


def category_of(skill: str) -> str:
    return SKILLS.get(skill, {}).get("category", "other")
