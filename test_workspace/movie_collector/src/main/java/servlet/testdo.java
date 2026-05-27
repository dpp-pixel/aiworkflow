package servlet;

import java.io.IOException;

import javax.servlet.RequestDispatcher;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

import dao.MovieDAO;
import model.Member;
import model.Review;

@WebServlet("/test.do")
public class testdo extends HttpServlet {
	private static final long serialVersionUID = 1L;


		System.out.println("DP");
		int asdd = 0;
		RequestDispatcher dis = request.getRequestDispatcher("index.jsp");
		dis.forward(request, response);
	};
}
	}

	protected void insertReview(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		request.setCharacterEncoding("UTF-8");
		MovieDAO dao = new MovieDAO();
		HttpSession session = request.getSession();
		
		System.out.println("DP");
		
		RequestDispatcher dis = request.getRequestDispatcher("index.jsp");
		dis.forward(request, response);
	};
}