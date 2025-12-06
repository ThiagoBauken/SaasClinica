import os
import uuid
import sqlite3
from flask import Flask, request, redirect, url_for, send_from_directory, render_template, jsonify, session, g
from werkzeug.utils import secure_filename
from py import process_uploaded_files, parse_gpt_output, save_to_excel
from functools import wraps

UPLOAD_FOLDER = 'uploads'
PROCESSED_FOLDER = 'processed'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'tiff'}

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['PROCESSED_FOLDER'] = PROCESSED_FOLDER
app.secret_key = 'Thiago666'  # Secret key for session management
DATABASE = 'database.db'
ACCESS_PASSWORD = 'Thiago666'  # The password to access the site

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

if not os.path.exists(PROCESSED_FOLDER):
    os.makedirs(PROCESSED_FOLDER)

# Function to check if the uploaded file has an allowed extension
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Database connection
def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def query_db(query, args=(), one=False):
    cur = get_db().execute(query, args)
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv

def init_db():
    with app.app_context():
        db = get_db()
        db.executescript('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            );
        ''')
        db.commit()

# Authentication decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('authenticated'):
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    if 'access_granted' in session and session['access_granted']:
        return redirect(url_for('home'))
    return redirect(url_for('password'))

@app.route('/home')
@login_required
def home():
    return render_template('home.html')

@app.route('/password', methods=['GET', 'POST'])
def password():
    if request.method == 'POST':
        entered_password = request.form['password']
        if entered_password == ACCESS_PASSWORD:
            session['access_granted'] = True
            return redirect(url_for('login'))
        else:
            return render_template('password.html', error="Incorrect password.")
    return render_template('password.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'access_granted' not in session or not session['access_granted']:
        return redirect(url_for('password'))

    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = query_db('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], one=True)
        if user:
            session['authenticated'] = True
            session['user_id'] = user[0]
            session['username'] = user[1]
            return redirect(url_for('home'))
        else:
            return render_template('login.html', error="Invalid username or password.")
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/history', methods=['GET'])
@login_required
def history():
    files = query_db('SELECT filename FROM files WHERE user_id = ?', [session['user_id']])
    return render_template('history.html', files=files)

if __name__ == "__main__":
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
